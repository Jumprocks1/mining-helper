import { Icon } from "../../components/basic/IconButton"
import LoadingButton from "../../components/LoadingButton"
import { TrimKana } from "../../jpdb/JpdbState"
import AnkiConnect from "../../utils/AnkiConnect"
import { UnicodeCharacterType, unicodeType } from "../../utils/AnkiUtil"
import { AnkiFieldInfo, AnkiFieldKey, getSetting } from "../../views/SettingsModal"
import AnkiSettingsModal from "./AnkiSettingsModal"

// cache
let localAnkiWords: string[] | undefined
let localAnkiWordsSet: Set<string> | undefined
let localAnkiWordsTrimKanaMap: Map<string, string> | undefined

export function getAnkiWordsSetSync() {
    if (!localAnkiWords) return
    return localAnkiWordsSet ??= new Set(localAnkiWords)
}

export function getAnkiWordsTrimKanaMapSync() {
    if (!localAnkiWords) return
    if (!localAnkiWordsTrimKanaMap) {
        localAnkiWordsTrimKanaMap ??= new Map()
        for (const word of localAnkiWords) {
            const trimmed = TrimKana(word)
            if (trimmed === "") continue
            // this will overwrite some, that's fine
            localAnkiWordsTrimKanaMap.set(trimmed, word)
        }
    }
    return localAnkiWordsTrimKanaMap
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
    if (localAnkiWordsSet) localAnkiWordsSet.add(word)
    return words
}


export default async () => {
    const refresh = new LoadingButton({
        onClick: async () => {
            // this returns a ton of info we don't really want right now
            // only need the word field
            // it responds instantly pretty much, so the extra web traffic is fine
            // for me it's 2.6MB
            // saved to local storage was only 15kB
            const configuredFields = await getSetting("ankiFields")
            function fieldName(key: AnkiFieldKey) {
                return configuredFields[key] ?? AnkiFieldInfo[key].name
            }
            const notes = await AnkiConnect.call("notesInfo", { query: "" })
            localAnkiWords = []
            for (const note of notes) {
                const word = note.fields[fieldName("word")]?.value
                if (word) localAnkiWords.push(word)
            }
            // don't need to await this
            chrome.storage.local.set({ ankiWords: localAnkiWords })
            await update(false)
        }
    })
    refresh.Node.innerText = "Refresh"
    refresh.Loading = true

    const loadedCount = <span />
    const uniqueCharacters = <div />
    const uniqueKanji = <div tooltip={`Only includes kanji in the word field`} />

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
        const kanji = sets[UnicodeCharacterType.Kanji]
        uniqueKanji.textContent = `Unique Kanji: ${kanji?.size ?? 0}`;
        refresh.Loading = false
    }

    update(false)

    const apiKey = await getSetting("ankiConnectApiKey")
    let warning: HTMLElement | undefined
    if (!apiKey) {
        warning = <div className="warning">
            No AnkiConnect API key set, <button className="link-button" onclick={AnkiSettingsModal}>click here to set one</button>
        </div>
    } else if (!await getSetting("targetAnkiDeck")) {
        warning = <div className="warning">
            No target deck set, <button className="link-button" onclick={AnkiSettingsModal}>click here to set one</button>
        </div>
    }

    return <div className="card-list">
        {warning}
        <button onclick={AnkiSettingsModal}><Icon icon="settings" />Anki Settings</button>
        <div className="flex-row">{loadedCount} {refresh}</div>
        {uniqueCharacters}
        {uniqueKanji}
    </div>
}
