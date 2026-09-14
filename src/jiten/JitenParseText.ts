import { getSetting } from "../core/Settings";
import { JpdbParseResponse, JpdbVocabulary } from "../jpdb/JpdbParseText";
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

export async function JitenParseText(s: string[], fullJoin: string): Promise<JpdbParseResponse> {
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
        // TODO don't think we use reading anywhere? need to double check
        const jpdbVocab: JpdbVocabulary = [
            vocab.spelling, "", vocab.frequencyRank, vocab.meaningsChunks.map(e => e.join("; ")),
            [] as string[], -1, [] as string[]
        ] as JpdbVocabulary
        // TODO the furigana here is bad when there's kana in the middle of the word
        jpdbVocab.furigana = vocab.reading
        jpdbVocab.jitenId = vocab.wordId + "," + vocab.readingIndex
        finalRes.vocabulary.push(jpdbVocab)
        i += 1
    }
    for (const token of jitenTokens) {
        // start: number,
        // length: number,
        // reading: ([string, string] | string)[] | null,
        // vocab_index: number
        // TODO load the token reading from the vocab...
        // TODO conjugations would be nice to grab
        finalRes.tokens.push([token.start, token.length, null, vocabIndexMap.get(vocabMap.get(token.wordId + "," + token.readingIndex)!)!])
    }
    return finalRes
}