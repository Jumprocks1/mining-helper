import { getSetting } from "../core/Settings";
import { JpdbParseResponse, JpdbVocabulary } from "../jpdb/JpdbParseText";
import { getStringHash } from "../reader/Library";
import BrowserCache from "../utils/BrowserCache";
import UserError from "../utils/UserError";
import { delay } from "../utils/util";

const maxParseCharacters = 50_000 // the API seems to list 81000 as the limit. Staying under to be safe with new lines and such

export interface JitenResponse {
    status?: number
    errors?: {
        "$": string[]
        request: string[]
    }
}

// This is a mess with CORS, so won't really work for most people
export async function callJiten<T extends JitenResponse>(endpoint: string, body: any) {
    if (typeof browser !== "undefined" && navigator.userActivation && navigator.userActivation.isActive) {
        const req = { origins: ["https://api.jiten.moe/api/*"] }
        const hasPerms = await browser.permissions.contains(req)
        if (!hasPerms) await browser.permissions.request(req)
    }
    const res = await fetch(`https://api.jiten.moe/api/${endpoint}`, {
        method: "POST",
        headers: {
            "X-API-Key": await getSetting("jitenApiKey"),
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    })
    if (!res.ok) {
        const json = await res.json() as JitenResponse | undefined
        if (json?.errors) throw new UserError("Failed to fetch Jiten:\n" + json.errors.request.join("\n"))
        throw new UserError("Failed to fetch Jiten\n" + (await res.text()).substring(0, 1000))
    }
    return res.json() as Promise<T>
}

export interface JitenToken {
    wordId: number
    readingIndex: number
    start: number
    end: number
    length: number
    conjugations: string[]
}

export interface JitenVocabulary {
    wordId: number
    readingIndex: number
    spelling: string
    reading: string
    frequencyRank: number
    partsOfSpeech: string[]
    meaningsChunks: string[][]
    meaningsPartOfSpeech: string[]
    knownState: number[]
    pitchAccents: number[]
}


export interface JitenParseResponse extends JitenResponse {
    tokens: JitenToken[][]
    vocabulary: JitenVocabulary[]
}
export const JitenCache = new BrowserCache("jiten-parse")
export async function JitenParseText(s: string[], fullJoin: string, cacheOnly?: boolean): Promise<JpdbParseResponse | undefined> {
    const res = await JitenCache.GetJson(await getStringHash(fullJoin), cacheOnly ? undefined : () => JitenParseTextNoCache(s, fullJoin))
    if (res) {
        for (const vocab of res.vocabulary) {
            vocab.furigana = vocab[7]
        }
    }
    return res
}
async function JitenParseTextNoCache(s: string[], fullJoin: string): Promise<JpdbParseResponse> {
    // Note, we're still returning Jpdb parse responses from this
    let start = 0 // line number start of next request
    let responseOffset = 0 // character count to add to token indexes after response
    let sentCount = 0 // how many requests we've hit Jiten with
    const vocabMap = new Map<string, JitenVocabulary>()
    const jitenTokens: JitenToken[] = []
    while (start < s.length) {
        let end = start;
        let len = -1; // -1 since first line doesn't have a \n
        while (end < s.length) {
            if (len + s[end].length + 1 > maxParseCharacters) break
            len += s[end].length + 1
            end += 1;
        }
        console.log(`Fetching ${start}-${end} / ${s.length} lines, ${len} / ${fullJoin.length} characters`)
        // Jiten does accept arrays, but I think this will be easier to manage at least for now
        // Otherwise we'd have to add the \n offset after parsing
        const text = s.slice(start, end).join("\n")
        const json = await callJiten<JitenParseResponse>("reader/parse", { text: [text] })
        for (const token of json.tokens[0]) {
            token.start += responseOffset
            token.end += responseOffset
            jitenTokens.push(token)
        }
        for (const vocab of json.vocabulary) vocabMap.set(vocab.wordId + "," + vocab.readingIndex, vocab)
        sentCount += 1
        responseOffset += text.length + 1 // +1 because the merged text will have another \n

        start = end
        if (start < s.length && sentCount >= 2) await delay(2000)
    }
    const finalRes: JpdbParseResponse = { tokens: [], vocabulary: [] }
    const vocabIndexMap = new Map<JitenVocabulary, number>()
    let i = 0
    for (const vocab of vocabMap.values()) {
        vocabIndexMap.set(vocab, i)
        const jpdbVocab: JpdbVocabulary = [
            vocab.spelling, "", roundFrequency(vocab.frequencyRank), vocab.meaningsChunks.map(e => e.join("; ")),
            vocab.partsOfSpeech.map(e => e === "particle" ? "prt" : e), -1, [] as string[],
            cleanJitenFurigana(vocab.reading)
        ] as JpdbVocabulary
        vocab.reading = cleanJitenFurigana(vocab.reading)
        jpdbVocab.jitenId = vocab.wordId + "," + vocab.readingIndex
        finalRes.vocabulary.push(jpdbVocab)
        i += 1
    }
    for (const token of jitenTokens) {
        const vocab = vocabMap.get(token.wordId + "," + token.readingIndex)!

        /* Conjugation filter based on:
            https://github.com/Sirush/Jiten/blob/f30391ca59f92b6a3cb29e3c9d58ae52f47a1ed6/Jiten.Web/app/components/VocabularyDetail.vue#L244-L252
            I don't know why they have the filters or the reverse
        */
        const conjugations = token.conjugations.filter(e => !e.startsWith("(") && e).reverse()
        finalRes.tokens.push([token.start, token.length,
        readingFromFurigana(fullJoin.substring(token.start, token.end), vocab.reading), vocabIndexMap.get(vocab)!, conjugations])
    }
    return finalRes
}

function roundFrequency(n: number) {
    // think this makes it easier to read/compare, could be wrong
    if (n < 100) return Math.ceil(n / 10) * 10
    if (n < 10000) return Math.ceil(n / 100) * 100
    return Math.ceil(n / 1000) * 1000
}

export function cleanJitenFurigana(furi: string) {
    // Based on this https://github.com/Sirush/Jiten/blob/master/Jiten.Web/app/utils/convertToRuby.ts:
    // I dispise this way of doing things, but it's needed to match jiten's behavior
    const groupCharacter = /[一-鿿０-ｚ々ヵヶ]/
    let o = ""
    let pendingGroup: number | undefined
    let inside = false
    for (let i = 0; i < furi.length; i++) {
        const c = furi[i]
        if (inside) {
            if (c === "]") inside = false
            o += c
        } else if (c.match(groupCharacter)) {
            if (pendingGroup === undefined) pendingGroup = i
        } else if (c === "[" && pendingGroup !== undefined) {
            if (o.length > 0 && o[o.length - 1] !== "]") o += " "
            inside = true
            o += furi.substring(pendingGroup, i)
            pendingGroup = undefined
            o += c
        } else {
            pendingGroup = undefined
            o += c
        }
    }
    if (pendingGroup !== undefined) o += furi.substring(pendingGroup)
    return o
}

export function readingFromFurigana(token: string, vocabFurigana: string): (string | [string, string])[] {
    const o: (string | [string, string])[] = []

    let j = 0 // position inside furigana
    for (let i = 0; i < token.length; i++) {
        const c = token[i]

        let found: number | undefined = undefined
        let insideBrackets = false
        for (let k = j; k < vocabFurigana.length; k++) {
            const f = vocabFurigana[k]
            if (f === "[") insideBrackets = true
            else if (f === "]") insideBrackets = false
            if (f === c && !insideBrackets) {
                found = k
                break
            }
        }
        let added = false
        if (found !== undefined) {
            j = found
            const nextBracket = vocabFurigana.indexOf("[", found)
            if (nextBracket != -1) {
                const closingBracket = vocabFurigana.indexOf("]", nextBracket)
                if (closingBracket != -1) {
                    const cSub = token.substring(i, i + nextBracket - found)
                    if (vocabFurigana.substring(found, nextBracket) === cSub) {
                        o.push([cSub, vocabFurigana.substring(nextBracket + 1, closingBracket)])
                        i += cSub.length - 1 // if we read extra characters, skip processing them later
                        j = closingBracket
                        added = true
                    }
                }
            }
        }
        if (!added) {
            if (o.length > 0 && !Array.isArray(o[o.length - 1])) {
                o[o.length - 1] += c
            } else o.push(c)
        }
    }
    return o
}