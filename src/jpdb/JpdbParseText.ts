import { hash, Subtitles } from "../utils/srt";
import { delay, getJpdbApiKey } from "../utils/util";
import "../utils/CharacterHighlighter";
import { getAnkiWordsSetSync, getAnkiWordsSync, UnicodeCharacterType, unicodeType } from "../anki/CardList";

// spelling, reading, frequency_rank, meanings, parts of speech, vid, alt_spelling
export type JpdbVocabulary = [string, string, number, string[], string[], number, string[]]

export interface JpdbParseResponse {
    // start, length, reading, vocab index
    tokens: [number, number, (string | [string, string])[] | null, number][]
    vocabulary: JpdbVocabulary[]
}

export enum VocabState {
    New,
    Known,
    Particle,
    Kana,
    Similar,
    AltSpelling,
    Ignored
}

// somewhat expensive (profiler says otherwise though)
export function getVocabState(vocab: JpdbVocabulary): VocabState {
    return getVocabStateAndNote(vocab)[0]
}
export function getVocabStateAndNote(vocab: JpdbVocabulary): [VocabState, any] {
    const knownWords = getAnkiWordsSync()
    const knownWordsSet = getAnkiWordsSetSync()
    const word = vocab[0]
    if (vocab && knownWordsSet) {
        if (knownWordsSet.has(word))
            return [VocabState.Known, undefined]
        for (const spelling of vocab[6])
            if (knownWordsSet.has(spelling))
                return [VocabState.AltSpelling, spelling]
    }
    if (vocab[4].includes("prt"))
        return [VocabState.Particle, undefined]
    let kanji = false
    for (let i = 0; i < word.length; i++) {
        const unicode = unicodeType(word[i])
        if (unicode === UnicodeCharacterType.Kanji)
            kanji = true;
    }
    // TODO these can still be valuable
    // stop filtering once we set up good ignoring
    if (!kanji) return [VocabState.Kana, undefined]
    if (knownWords) {
        const startsWithKanji = unicodeType(word[0]) === UnicodeCharacterType.Kanji
        const endsWithKanji = unicodeType(word[word.length - 1]) === UnicodeCharacterType.Kanji
        const start = word.substring(0, word.length - 1)
        const end = word.substring(1, word.length)
        for (const knownWord of knownWords) {
            if (knownWord.length > 0) {
                if (knownWord.length === word.length - 1) {
                    if (!endsWithKanji && word.startsWith(knownWord))
                        return [VocabState.Similar, knownWord]
                    if (!startsWithKanji && word.endsWith(knownWord))
                        return [VocabState.Similar, knownWord]
                } else if (knownWord.length === word.length) {
                    if (!endsWithKanji && knownWord.startsWith(start) &&
                        unicodeType(knownWord[knownWord.length - 1]) !== UnicodeCharacterType.Kanji)
                        return [VocabState.Similar, knownWord]
                    if (!startsWithKanji && knownWord.endsWith(end) &&
                        unicodeType(knownWord[0]) !== UnicodeCharacterType.Kanji)
                        return [VocabState.Similar, knownWord]
                }
            }
        }
    }
    return [VocabState.New, undefined]
}

export async function JpdbParseSubtitles(subtitles: Subtitles) {
    // can't do replacements since then the indices won't map properly
    // const replacements = await getReplacements()
    // we would have to do some advanced replacements to get this to work
    // const lines = subtitles.processedEntries
    //     .map(e => applyReplacementsTo(replacements, e.text, true))
    const lines = subtitles.processedEntries.map(e => e.text)
    const res = await JpdbParseText(lines)
    subtitles.jpdbParse = res
    return res
}

const minimumAvailable = 1_000_000 // want at least 1 MB spare
const maxEntries = 20

interface CacheInfo {
    key: string // excludes prefix since it's stored in cacheInfoKey
    time: number
}

const cachePrefix = "jpdb_cache_"
const cacheInfoKey = cachePrefix + "cacheInfo"

async function cacheCleanNoSave() {
    const quota = chrome.storage.local.QUOTA_BYTES
    const cacheInfo = (await chrome.storage.local.get({ [cacheInfoKey]: [] }))[cacheInfoKey] as CacheInfo[]
    cacheInfo.sort((a, b) => b.time - a.time)
    while ((quota - await chrome.storage.local.getBytesInUse()) < minimumAvailable || cacheInfo.length > maxEntries) {
        const pop = cacheInfo.pop()
        if (!pop) break
        await chrome.storage.local.remove(cachePrefix + pop.key)
    }
    return cacheInfo
}

async function cacheStore(key: string, value: any) {
    const cacheInfo = await cacheCleanNoSave()
    let found = false
    for (let i = 0; i < cacheInfo.length; i++) {
        if (cacheInfo[i].key === key) {
            cacheInfo[i].time = Date.now()
            found = true
        }
    }
    if (!found) cacheInfo.push({ key, time: Date.now() })
    await chrome.storage.local.set({ [cachePrefix + key]: value, [cacheInfoKey]: cacheInfo })
}

async function cacheValue<T>(key: string, get: () => Promise<T>, forceRefresh?: boolean): Promise<T> {
    const cacheKey = cachePrefix + key
    if (forceRefresh) {
        const value = await get()
        cacheStore(key, value)
        return value
    }
    const found = (await chrome.storage.local.get(cacheKey))[cacheKey] as T | undefined
    if (!found) {
        const value = await get()
        cacheStore(key, value)
        return value
    } else {
        return found
    }
}

// had this fail at 5981 characters
// seems inconsistent, might exclude certain characters or something
const maxParseCharacters = 5000

// measured ~150kB per episode
export default async function JpdbParseText(s: string[]) {
    const fullJoin = s.join("\n")
    const value = await cacheValue("jpdb_" + hash(fullJoin), async () => {
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
    })
    console.log(value)
    return value as JpdbParseResponse
}
