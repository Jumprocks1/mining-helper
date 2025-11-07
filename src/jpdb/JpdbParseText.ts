import { hash, Subtitles } from "../utils/srt";
import { getJpdbApiKey } from "../utils/util";
import "../utils/CharacterHighlighter";

export interface JpdbParseResponse {
    // start, length, reading, vocab index
    tokens: [number, number, (string | [string, string])[] | null, number][]
    // spelling, reading, frequency_rank, meanings
    vocabulary: [string, string, number, string[]][]
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

export default async function JpdbParseText(s: string[]) {
    const fullJoin = s.join("\n")
    const value = await cacheValue("jpdb_" + hash(fullJoin), async () => {
        // TODO if we exceed limit, send more requests after a second or so
        let count = 0;
        let len = -1; // -1 since first line doesn't have a \n
        while (count < s.length) {
            if (len + s[count].length + 1 > maxParseCharacters) break
            len += s[count].length + 1
            count += 1;
        }
        console.log(`Taking ${count} lines, ${len} out of ${s.length}, ${fullJoin.length}`)
        const res = await fetch("https://jpdb.io/api/v1/parse", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${await getJpdbApiKey()}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: s.slice(0, count).join("\n"),
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
                    "meanings"
                ],
                position_length_encoding: "utf16"
            })
        })
        const json = await res.json()
        // console.log(json)
        return json
    })
    console.log(value)
    return value as JpdbParseResponse
}
