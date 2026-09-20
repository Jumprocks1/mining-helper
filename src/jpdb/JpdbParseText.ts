import { hash, Subtitles } from "../utils/srt";
import { delay, furiFromToken } from "../utils/util";
import BrowserCache from "../utils/BrowserCache";
import { loadIgnoreList } from "./IgnoreList";
import { ThrowUserError } from "../utils/UserError";
import { getSetting } from "../core/Settings";
import { JitenParseText } from "../jiten/JitenParseText";

export type JpdbVocabulary = [
    spelling: string,
    reading: string, // not used outside of JPDB parse
    frequency_rank: number | null,
    meanings: string[],
    parts_of_speech: string[],
    vid: number, // not used outside of JPDB parse
    alt_spelling: never[],
    furigana: string // TODO start using this instead
] & {
    // doesn't actually come populated from the API
    // set after parsing API response
    furigana: string // TODO stop using these since they don't get saved to cache
    jitenId?: string
}

export type JpdbToken = [
    start: number,
    length: number,
    reading: ([string, string] | string)[] | null,
    vocab_index: number,
    conjugations?: string[]
]

interface JpdbResponse {
    error?: string
    error_message?: string
}

export interface JpdbParseResponse extends JpdbResponse {
    tokens: JpdbToken[]
    vocabulary: JpdbVocabulary[]
}

export async function ParseSubtitles(subtitles: Subtitles, cacheOnly?: true) {
    // can't do replacements since then the indices won't map properly
    // const replacements = await getReplacements()
    // we would have to do some advanced replacements to get this to work
    // const lines = subtitles.processedEntries
    //     .map(e => applyReplacementsTo(replacements, e.text, true))
    const lines = subtitles.processedEntries.map(e => e.text)
    const res = await ParseText(lines, cacheOnly)
    loadIgnoreList() // hover stuff requires this, if it's already loaded this doesn't do anything
    if (res) subtitles.jpdbParse = res
    return res
}


export const JpdbCache = new BrowserCache("jpdb-parse", 4_000_000, 20)

// had this fail at 5981 characters
// seems inconsistent, might exclude certain characters or something
const maxParseCharacters = 5000

export function ensureNoJpdbError(response: JpdbResponse) {
    if (!response.error && !response.error_message) return
    if (response.error === "bad_key") {
        if (response.error_message?.includes("missing"))
            ThrowUserError("Missing jpdb.io API key", "Please set one in the settings menu")
        ThrowUserError("Invalid jpdb.io API key", "Please make sure one is set in the settings menu")
    }
    ThrowUserError("Error with jpdb.io:", response.error_message)
}

// measured ~150kB per episode
async function JpdbParseTextNoCache(s: string[], fullJoin: string) {
    const finalRes: JpdbParseResponse = { tokens: [], vocabulary: [] }
    let start = 0 // line number start of next request
    let responseOffset = 0 // character count to add to token indexes after response
    let sentCount = 0 // how many requests we've hit jpdb with
    while (start < s.length) {
        let end = start;
        let len = -1; // -1 since first line doesn't have a \n
        while (end < s.length) {
            if (len + s[end].length + 1 > maxParseCharacters) break
            len += s[end].length + 1
            end += 1;
        }
        console.log(`Fetching ${start}-${end} / ${s.length} lines, ${len} / ${fullJoin.length} characters`)
        const text = s.slice(start, end).join("\n")
        const json = await callJpdb<JpdbParseResponse>("parse", {
            text,
            token_fields: [
                "position",
                "length",
                "furigana",
                "vocabulary_index"
            ],
            vocabulary_fields: [
                "spelling",
                "reading",
                "frequency_rank",
                "meanings",
                "part_of_speech",
                "vid",
                "alt_spellings"
            ],
            position_length_encoding: "utf16"
        })
        ensureNoJpdbError(json)
        for (const token of json.tokens) {
            token[0] += responseOffset
            token[3] += finalRes.vocabulary.length
            finalRes.tokens.push(token)
        }
        for (const vocab of json.vocabulary) {
            finalRes.vocabulary.push(vocab)
        }
        sentCount += 1
        responseOffset += text.length + 1 // +1 because the merged text will have another \n
        start = end
        // not sure if needed, I accidentally sent like 20 in a row before without issue
        // anime are usually ~1-1.3 requests, so most of the time this will never trigger
        if (start < s.length && sentCount >= 2) await delay(2000)
    }
    const vocabMapping = new Map<number, number>()
    const indexMapping = new Map<number, number>()
    const dedupedVocab = []
    const dupedVocab = finalRes.vocabulary
    for (let i = 0; i < dupedVocab.length; i++) {
        const id = dupedVocab[i][5]
        const existing = vocabMapping.get(id)
        if (existing !== undefined) {
            indexMapping.set(i, existing)
        } else {
            indexMapping.set(i, dedupedVocab.length)
            vocabMapping.set(id, dedupedVocab.length)
            dedupedVocab.push(dupedVocab[i])
        }
    }
    finalRes.vocabulary = dedupedVocab
    for (const token of finalRes.tokens)
        token[3] = indexMapping.get(token[3])!
    return finalRes
}
export function ParseText(s: string[]): Promise<JpdbParseResponse>
export function ParseText(s: string[], cacheOnly: true | undefined): Promise<JpdbParseResponse | undefined>
export async function ParseText(s: string[], cacheOnly?: true) {
    const fullJoin = s.join("\n")
    if (await getSetting("preferJitenApi") && await getSetting("jitenApiKey")) {
        return await JitenParseText(s, fullJoin, cacheOnly)
    }
    const res = await JpdbCache.GetJson(hash(fullJoin).toString(), cacheOnly ? undefined : () => JpdbParseTextNoCache(s, fullJoin))
    if (res) {
        // post-cached processing
        for (let i = 0; i < res.tokens.length; i++) {
            const token = res.tokens[i]
            const vocab = res.vocabulary[token[3]]
            if (vocab && !vocab.furigana) {
                vocab.furigana = furiFromToken(vocab[0], token)
                if (!vocab.furigana.includes("[")) {
                    // happens if the token doesn't 100% match the vocab kanji parts
                    // どー考えても vs どう考えても
                    // may also happen for kana-only, but the method below should just return vocab[0] in that case
                    vocab.furigana = furiganaFromFullReading(vocab[0], vocab[1])
                }
            }
        }
    }
    return res
}

// trims excess reading information and then combines
// similar to `furiganaTrimmed`
// doesn't handle splitting kanji readings or kana between kanji
export function furiganaFromFullReading(base: string, reading: string) {
    let i = 0;
    while (i < base.length && i < reading.length && base[i] === reading[i]) i += 1
    let j = 0;
    while (j < base.length && j < reading.length && base[base.length - j - 1] === reading[reading.length - j - 1]) j += 1
    if (i + j >= base.length) return base
    reading = reading.substring(i, reading.length - j)
    let o = `${base.substring(i, base.length - j)}[${reading}]`
    if (i > 0) o = `${base.substring(0, i)} ${o}`;
    if (j > 0) o += ` ${base.substring(base.length - j)}`
    return o
}

export async function callJpdb<T extends JpdbResponse>(endpoint: string, body: any) {
    const res = await fetch(`https://jpdb.io/api/v1/${endpoint}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${await getSetting("jpdbApiKey")}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    })
    return res.json() as Promise<T>
}

interface TranslateResponse extends JpdbParseResponse {
    text?: string
}
const translationCache = new Map<string, string>()
// TODO add Google translate
// https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ja&dt=t&q=How%20old%20are%20you
export async function jpdbTranslate(text: string) {
    const cache = translationCache.get(text)
    if (cache) return cache
    if (text.length > 1000) throw "Text too long"
    console.log(`translating ${text.length} characters...`)
    const res = await callJpdb<TranslateResponse>("ja2en", { text })
    if (!res.text) throw "Failed to translate.\n" + JSON.stringify(res)
    translationCache.set(text, res.text)
    return res.text
}