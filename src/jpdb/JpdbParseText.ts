import { hash, Subtitles } from "../utils/srt";
import { delay, getJpdbApiKey } from "../utils/util";
import StorageCache from "../utils/StorageCache";
import { loadIgnoreList } from "./IgnoreList";

export type JpdbVocabulary = [
    spelling: string,
    reading: string,
    frequency_rank: number | null,
    meanings: string[],
    parts_of_speech: string[],
    vid: number,
    alt_spelling: string[]
]

export type JpdbToken = [
    start: number,
    length: number,
    reading: ([string, string] | string)[] | null,
    vocab_index: number
]

export interface JpdbParseResponse {
    tokens: JpdbToken[]
    vocabulary: JpdbVocabulary[]
}

export async function JpdbParseSubtitles(subtitles: Subtitles, cacheOnly?: true) {
    // can't do replacements since then the indices won't map properly
    // const replacements = await getReplacements()
    // we would have to do some advanced replacements to get this to work
    // const lines = subtitles.processedEntries
    //     .map(e => applyReplacementsTo(replacements, e.text, true))
    const lines = subtitles.processedEntries.map(e => e.text)
    const res = await JpdbParseText(lines, cacheOnly)
    loadIgnoreList() // hover stuff requires this, if it's already loaded this doesn't do anything
    if (res) subtitles.jpdbParse = res
    return res
}


export const JpdbCache = new StorageCache({
    prefix: "jpdb_cache_",
    maxEntries: 20
})

// had this fail at 5981 characters
// seems inconsistent, might exclude certain characters or something
const maxParseCharacters = 5000

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
        const res = await fetch("https://jpdb.io/api/v1/parse", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await getJpdbApiKey()}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
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
        })
        const json = await res.json() as JpdbParseResponse
        for (const token of json.tokens) {
            token[0] += responseOffset
            token[3] += finalRes.vocabulary.length
            finalRes.tokens.push(token)
        }
        for (const vocab of json.vocabulary) {
            // TODO could dedup these if needed
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

export default async function JpdbParseText(s: string[], cacheOnly?: true) {
    const fullJoin = s.join("\n")
    return await JpdbCache.Get("jpdb_" + hash(fullJoin), cacheOnly ? undefined : () => JpdbParseTextNoCache(s, fullJoin))
}
