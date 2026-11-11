import { hash, Subtitles } from "../utils/srt";
import { delay, furiFromToken, getStringHash } from "../utils/util";
import BrowserCache from "../utils/BrowserCache";
import { loadIgnoreList } from "./IgnoreList";
import { ThrowUserError } from "../utils/UserError";
import { getSetting } from "../core/Settings";
import { JitenCache, JitenParseText } from "../jiten/JitenParseText";
import { furiBaseAndReading } from "./JpdbState";

export type JpdbVocabulary = [
    spelling: string,
    reading: string, // only used by jpdb parse methods, prefer furigana elsewhere
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
async function preferJiten() {
    return await getSetting("preferJitenApi") && await getSetting("jitenApiKey")
}
export function ParseText(s: string[]): Promise<JpdbParseResponse>
export function ParseText(s: string[], cacheOnly: true | undefined, skipSave?: true): Promise<JpdbParseResponse | undefined>
export async function ParseText(s: string[], cacheOnly?: true, skipSave?: true) {
    // TODO the text here 100% changes when there's furigana overrides
    // Looks like it's because it splits text nodes, which can leave spaces in their own nodes
    // Since we don't trim and instead completely skip whitespace-only nodes, this causes some issues
    const fullJoin = s.join("\n")
    if (await preferJiten()) {
        return await JitenParseText(s, fullJoin, cacheOnly, skipSave)
    }
    const res = await JpdbCache.GetJson(await getStringHash(fullJoin), cacheOnly ? undefined : () => JpdbParseTextNoCache(s, fullJoin), undefined, skipSave)
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
export async function updateParseCache(oldLines: string[], newLines: string[], newJpdb: JpdbParseResponse) {
    const oldCacheKey = await getStringHash(oldLines.join("\n"))
    const newCacheKey = await getStringHash(newLines.join("\n"))
    const cache = await preferJiten() ? JitenCache : JpdbCache
    cache.Remove(oldCacheKey)
    cache.Put(newCacheKey, newJpdb)
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
    if (j > 0) o += `${base.substring(base.length - j)}`
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
export async function translate(text: string) {
    text = text.trim()
    const cache = translationCache.get(text)
    if (cache) return cache
    if (text.length > 1000) throw "Text too long"
    console.log(`translating ${text.length} characters...`)
    const res = await googleTranslate(text) || await jpdbTranslate(text)
    translationCache.set(text, res)
    return res
}
async function jpdbTranslate(text: string) {
    const res = await callJpdb<TranslateResponse>("ja2en", { text })
    if (!res.text) throw "Failed to translate.\n" + JSON.stringify(res)
    return res.text
}
// This API is undocumented and could easily break randomly
// It does seem a little better than jpdb though
export async function googleTranslate(text: string) {
    const url = new URL("https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t")
    url.searchParams.append("q", text)
    const res = await fetch(url)
    const json = await res.json()
    return json[0].map((e: string[]) => e[0]).join("\n")
}
export async function tts(text: string) {
    text = text.trim()
    if (text.length > 1000) throw "Text too long"
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = "ja"
    speechSynthesis.speak(utter)
}

function combine(a: [string, boolean], b: [string, boolean], c: string): [furigana: string, perfect: boolean] {
    const bracket = b[0].indexOf("[")
    const spacePos = b[0].indexOf(" ")
    const space = bracket === -1 ? "" : spacePos === -1 ? " " : spacePos < bracket ? "" : " "
    return [a[0] + c + space + b[0], a[1] && b[1]]
}

function furiganaFromFullReading2Inner(base: string, reading: string): [furigana: string, perfect: boolean] {
    if (reading.length === 0) return [base, true]
    if (base.length === 1) return [`${base}[${reading}]`, true]

    for (let i = 0; i < base.length; i++) {
        const c = base[i]
        const ri = reading.indexOf(c)
        if (ri !== -1 && ri === reading.lastIndexOf(c)) {
            const a = furiganaFromFullReading2Inner(base.substring(0, i), reading.substring(0, ri))
            const b = furiganaFromFullReading2Inner(base.substring(i + 1), reading.substring(ri + 1))
            return combine(a, b, c)
        } else if (ri !== -1) {
            const last = reading.lastIndexOf(c)
            // if one of the indexes matches the current index, we know the left part must be 1 kana per kanji
            if (last === i || ri === i) {
                const a = furiganaFromFullReading2Inner(base.substring(0, i), reading.substring(0, i))
                const b = furiganaFromFullReading2Inner(base.substring(i + 1), reading.substring(i + 1))
                return combine(a, b, c)
            }
            // could do the same counting from the right, oh well
        }
        // There are more edge cases I could add here, but doesn't seem worth it
    }
    return [`${base}[${reading}]`, false]
}
// see tests
// realistically this isn't much better than the regular furiganaFromFullReading
export function furiganaFromFullReading2(base: string, reading: string): [furigana: string, perfect: boolean] {
    let i = 0;
    while (i < base.length && i < reading.length && base[i] === reading[i]) i += 1
    let j = 0;
    while (j < base.length && j < reading.length && base[base.length - j - 1] === reading[reading.length - j - 1]) j += 1
    if (i + j >= base.length) return [base, true]
    reading = reading.substring(i, reading.length - j)
    let [o, perfect] = furiganaFromFullReading2Inner(base.substring(i, base.length - j), reading)
    if (i > 0) o = `${base.substring(0, i)} ${o}`;
    if (j > 0) o += `${base.substring(base.length - j)}`
    return [o, perfect]
}

export async function bulkFurigana(text: string[], readings?: (string | undefined)[]): Promise<string[]> {
    // We add some extra new lines to make sure context doesn't spread

    const estimatedFurigana = text.map((e, i) => {
        const reading = readings?.[i]
        if (!reading) return undefined
        return furiganaFromFullReading2(e, reading)
    })
    const o: string[] = []
    const unknown: number[] = []
    for (let i = 0; i < text.length; i++) {
        const furi = estimatedFurigana[i]
        if (furi && furi[1]) {
            o[i] = furi[0]
        } else unknown.push(i)
    }
    const unknownLines = unknown.map(e => text[e] + "\n\n")
    const parse = await ParseText(unknownLines)
    const fullJoin = unknownLines.join("\n")

    let p = 0
    let i = 0
    let tokenI = 0
    while (i < unknown.length) {
        const index = unknown[i]
        let furi = ""
        const nextP = p + text[index].length + 3
        while (tokenI < parse.tokens.length && parse.tokens[tokenI][0] < nextP) {
            if (furi && !furi.endsWith("]")) furi += " "
            const token = parse.tokens[tokenI]
            furi += furiFromToken(fullJoin.substring(token[0], token[0] + token[1]), token)
            tokenI += 1
        }

        const [, parsedReading] = furiBaseAndReading(furi)
        const reading = readings?.[index]
        if (reading && parsedReading !== reading.replaceAll(" ", "")) {
            const estimate = estimatedFurigana[index]![0]
            console.warn(`Reading mismatch for ${text[index]}: ${reading}, ${parsedReading}. Using ${estimate}`)
            o[index] = estimate
        } else {
            o[index] = furi
        }
        i += 1
        p = nextP
    }
    return o
}