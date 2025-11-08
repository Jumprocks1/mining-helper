import LoadingButton from "../components/LoadingButton"
import AnkiConnect from "../utils/AnkiConnect"

export enum UnicodeCharacterType {
    Kana,
    Punctuation,
    Kanji,
    Number,
    Other
}

export function unicodeType(c: string): UnicodeCharacterType {
    // https://stackoverflow.com/a/15034560/11435204
    // const code = c.code
    const unicode = c.charCodeAt(0)
    if (unicode >= 0x3000 && unicode <= 0x303f)
        return UnicodeCharacterType.Punctuation
    if (unicode >= 0x3040 && unicode <= 0x309f)
        return UnicodeCharacterType.Kana // hiragana
    if (unicode >= 0x30a0 && unicode <= 0x30ff)
        return UnicodeCharacterType.Kana // katakana
    if (unicode >= 0x4e00 && unicode <= 0x9faf)
        return UnicodeCharacterType.Kanji
    if (unicode >= 0xFF10 && unicode <= 0xFF19)
        return UnicodeCharacterType.Number
    return UnicodeCharacterType.Other
}

// cache
let localAnkiWords: string[] | undefined
let localAnkiWordsSet: Set<string> | undefined

export function getAnkiWordsSetSync() {
    if (!localAnkiWords) return
    return localAnkiWordsSet ??= new Set(localAnkiWords)
}

export function getAnkiWordsSync() { return localAnkiWords }

export async function getAnkiWords(disableCache = false): Promise<string[]> {
    if (!disableCache && localAnkiWords) return localAnkiWords
    return localAnkiWords = (await chrome.storage.local.get({ ankiWords: [] })).ankiWords
}

export async function addAnkiWord(word: string) {
    const words = await getAnkiWords(true) // can't use cache, too risky
    if (!words.includes(word)) {
        words.push(word)
        await chrome.storage.local.set({ ankiWords: words })
    }
    localAnkiWords = words
    if (localAnkiWordsSet) localAnkiWordsSet.add(word)
    return words
}


export default () => {
    const refresh = new LoadingButton({
        onClick: async () => {
            // this returns a ton of info we don't really want right now
            // only need the word field
            // it responds instantly pretty much, so the extra web traffic is fine
            // for me it's 2.6MB
            // saved to local storage was only 15kB
            const notes = await anki.call("notesInfo", { query: "" })
            localAnkiWords = notes.map(e => e.fields.Word.value)
            // don't need to await this
            chrome.storage.local.set({ ankiWords: localAnkiWords })
            await update(false)
        }
    })
    refresh.Node.innerText = "Refresh"
    refresh.Loading = true

    const anki = new AnkiConnect()
    const loadedCount = <span></span>
    const uniqueCharacters = <div></div>
    const uniqueSets = <div className="unique-sets"></div>

    async function update(disableCache: boolean) {
        const ankiWords = await getAnkiWords(disableCache)
        loadedCount.textContent = `Currently loaded notes: ${ankiWords.length}`

        const characters = new Set();
        const sets: Partial<Record<UnicodeCharacterType, Set<string>>> = {}
        for (const word of ankiWords) {
            for (const c of word) {
                characters.add(c)
                const type = unicodeType(c)
                const set = sets[type] ??= new Set()
                set.add(c)
            }
        }
        uniqueCharacters.textContent = `Unique Characters: ${characters.size}`
        let s = ""
        for (const setType in sets) {
            // @ts-expect-error
            const set = sets[setType]
            // @ts-expect-error
            s += `Unique ${UnicodeCharacterType[setType]}: ${set.size}\n`
        }
        uniqueSets.textContent = s;
        console.log(sets)
        refresh.Loading = false
    }

    update(false)

    return <div className="card-list">
        <div className="flex-row">{loadedCount} {refresh}</div>
        {uniqueCharacters}
        {uniqueSets}
    </div>
}
