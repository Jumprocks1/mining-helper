import { Icon } from "../../components/basic/IconButton"
import LoadingButton from "../../components/LoadingButton"
import { getSetting, AnkiFieldKey, AnkiFieldInfo, getSettingSync } from "../../core/Settings"
import { furiganaTrimmed, simplifiedFurigana, TrimKana } from "../../jpdb/JpdbState"
import AnkiConnect from "../../utils/AnkiConnect"
import { UnicodeCharacterType, unicodeType } from "../../utils/AnkiUtil"
import { BrowserStorage } from "../../utils/BrowserApi"
import { CardData } from "../../utils/util"
import AnkiSettingsModal, { getTargetNoteFilter } from "./AnkiSettingsModal"

// we started using furigana for everything since kanji alone is not enough without context
// kanji have multiple readings, and multiple readings can also target different kanji.
// Keying on furigana solves both these issuses

// cache
let localAnkiNoteKeys: string[] | undefined
let localAnkiNoteKeysSet: Set<string> | undefined
let localAnkiNoteKeysTrimmedMap: Map<string, string> | undefined

export function getAnkiNoteKeysSetSync() {
    if (!localAnkiNoteKeys) return
    return localAnkiNoteKeysSet ??= new Set(localAnkiNoteKeys)
}

export function getAnkiNoteKeysTrimmedMapSync() {
    if (!localAnkiNoteKeys) return
    if (!localAnkiNoteKeysTrimmedMap) {
        localAnkiNoteKeysTrimmedMap ??= new Map()
        const keyField = getSettingSync("ankiNoteKey")
        for (const key of localAnkiNoteKeys) {
            const trimmedKey = (keyField === "furigana" ? furiganaTrimmed(key) : TrimKana(key)) || key
            // this might overwrite some, that's fine
            localAnkiNoteKeysTrimmedMap.set(trimmedKey, key)
        }
    }
    return localAnkiNoteKeysTrimmedMap
}

export async function getAnkiNoteKeys(disableCache = false): Promise<string[]> {
    if (!disableCache && localAnkiNoteKeys) return localAnkiNoteKeys
    return localAnkiNoteKeys = (await BrowserStorage.local.get({ ankiFurigana: [] })).ankiFurigana
}

export async function trackNewAnkiCard(card: CardData) {
    const keyField = await getSetting("ankiNoteKey")
    const ankiKeys = await getAnkiNoteKeys(true) // can't use cache, too risky
    const newKey = keyField === "furigana" ? simplifiedFurigana(card.furigana) : card.kanji

    if (!ankiKeys.includes(newKey)) {
        ankiKeys.push(newKey)
        await BrowserStorage.local.set({ ankiFurigana: ankiKeys })
    }
    if (localAnkiNoteKeysSet) localAnkiNoteKeysSet.add(newKey)
    if (localAnkiNoteKeysTrimmedMap) {
        const trimmedKey = (keyField === "furigana" ? furiganaTrimmed(newKey) : TrimKana(newKey)) || newKey
        localAnkiNoteKeysTrimmedMap.set(trimmedKey, newKey)
    }
}

export async function refreshAnkiNoteList() {
    // this returns a ton of info we don't really want right now
    // only need the word field
    // it responds instantly pretty much, so the extra web traffic is fine
    // for me it's 2.6MB
    // saved to local storage was only 15kB
    const configuredFields = await getSetting("ankiFields")
    function fieldName(key: AnkiFieldKey) {
        return configuredFields[key] ?? AnkiFieldInfo[key].name
    }
    const notes = await AnkiConnect.call("notesInfo", { query: await getTargetNoteFilter() })
    const keyField = await getSetting("ankiNoteKey")
    localAnkiNoteKeys = []
    for (const note of notes) {
        if (keyField === "furigana") {
            const furi = note.fields[fieldName("wordFurigana")]?.value
            if (furi) localAnkiNoteKeys.push(simplifiedFurigana(furi))
        } else {
            const kanji = note.fields[fieldName("word")]?.value
            if (kanji) localAnkiNoteKeys.push(kanji)
        }
    }
    localAnkiNoteKeysSet = undefined
    localAnkiNoteKeysTrimmedMap = undefined
    // don't need to await this
    BrowserStorage.local.set({ ankiFurigana: localAnkiNoteKeys })
}


export default async () => {
    const refresh = new LoadingButton({
        onClick: async () => {
            await refreshAnkiNoteList()
            await update(false)
        }
    })
    refresh.Node.innerText = "Refresh"
    refresh.Loading = true

    const loadedCount = <span />
    const uniqueCharacters = <div />
    const uniqueKanji = <div tooltip={`Only includes kanji in the word field`} />

    async function update(disableCache: boolean) {
        const ankiFurigana = await getAnkiNoteKeys(disableCache)
        loadedCount.textContent = `Currently loaded notes: ${ankiFurigana.length}`

        const characters = new Set();
        const sets: Partial<Record<UnicodeCharacterType, Set<string>>> = {}
        for (const furigana of ankiFurigana) {
            for (const c of furigana) {
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
    } else if (!await getSetting("ankiVocabDeck")) {
        warning = <div className="warning">
            No target vocab deck set, <button className="link-button" onclick={AnkiSettingsModal}>click here to set one</button>
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
