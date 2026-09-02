import { Icon } from "../../components/basic/IconButton"
import LoadingButton from "../../components/LoadingButton"
import { furiganaTrimmed, simplifiedFurigana } from "../../jpdb/JpdbState"
import AnkiConnect from "../../utils/AnkiConnect"
import { UnicodeCharacterType, unicodeType } from "../../utils/AnkiUtil"
import { BrowserStorage } from "../../utils/BrowserApi"
import { AnkiFieldInfo, AnkiFieldKey, getSetting } from "../../views/SettingsModal"
import AnkiSettingsModal, { getTargetNoteFilter } from "./AnkiSettingsModal"

// we started using furigana for everything since kanji alone is not enough without context
// kanji have multiple readings, and multiple readings can also target different kanji.
// Keying on furigana solves both these issuses

// cache
let localAnkiFurigana: string[] | undefined
let localAnkiFuriganaSet: Set<string> | undefined
let localAnkiFuriganaTrimmedMap: Map<string, string> | undefined

export function getAnkiFuriganaSetSync() {
    if (!localAnkiFurigana) return
    return localAnkiFuriganaSet ??= new Set(localAnkiFurigana)
}

export function getAnkiFuriganaTrimmedMapSync() {
    if (!localAnkiFurigana) return
    if (!localAnkiFuriganaTrimmedMap) {
        localAnkiFuriganaTrimmedMap ??= new Map()
        for (const furigana of localAnkiFurigana) {
            const trimmed = furiganaTrimmed(furigana)
            if (trimmed === "") continue
            // this might overwrite some, that's fine
            localAnkiFuriganaTrimmedMap.set(trimmed, furigana)
        }
    }
    return localAnkiFuriganaTrimmedMap
}

export function getAnkiFuriganaSync() { return localAnkiFurigana }

export async function getAnkiFurigana(disableCache = false): Promise<string[]> {
    if (!disableCache && localAnkiFurigana) return localAnkiFurigana
    return localAnkiFurigana = (await BrowserStorage.local.get({ ankiFurigana: [] })).ankiFurigana
}

export async function addAnkiFurigana(furi: string) {
    furi = simplifiedFurigana(furi)
    const ankiFuri = await getAnkiFurigana(true) // can't use cache, too risky
    if (!ankiFuri.includes(furi)) {
        ankiFuri.push(furi)
        await BrowserStorage.local.set({ ankiFurigana: ankiFuri })
    }
    if (localAnkiFuriganaSet) localAnkiFuriganaSet.add(furi)
    if (localAnkiFuriganaTrimmedMap) {
        const key = furiganaTrimmed(furi)
        if (key !== "") localAnkiFuriganaTrimmedMap.set(key, furi)
    }
    return ankiFuri
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
            const notes = await AnkiConnect.call("notesInfo", { query: await getTargetNoteFilter() })
            localAnkiFurigana = []
            for (const note of notes) {
                const furi = note.fields[fieldName("wordFurigana")]?.value
                if (furi) localAnkiFurigana.push(simplifiedFurigana(furi))
            }
            localAnkiFuriganaSet = undefined
            localAnkiFuriganaTrimmedMap = undefined
            // don't need to await this
            BrowserStorage.local.set({ ankiFurigana: localAnkiFurigana })
            await update(false)
        }
    })
    refresh.Node.innerText = "Refresh"
    refresh.Loading = true

    const loadedCount = <span />
    const uniqueCharacters = <div />
    const uniqueKanji = <div tooltip={`Only includes kanji in the word field`} />

    async function update(disableCache: boolean) {
        const ankiFurigana = await getAnkiFurigana(disableCache)
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
