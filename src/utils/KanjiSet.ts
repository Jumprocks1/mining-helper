import AnkiConnect from "./AnkiConnect"
import { BrowserStorage } from "./BrowserApi"

type KanjiSet = Set<string> // single characters

let localKanjiSet: KanjiSet | undefined

const knownKanjiAnkiQuery = `"deck:Mining Helper Kanji" -is:suspended`

export async function loadKanjiSet(disableCache = false) {
    if (!disableCache && localKanjiSet) return localKanjiSet
    const list = (await BrowserStorage.local.get({ knownKanjiList: [] })).knownKanjiList
    localKanjiSet = new Set(list)
    return localKanjiSet
}

export async function addKnownKanji(kanji: string) {
    const set = await loadKanjiSet()
    set.add(kanji)
    await BrowserStorage.local.set({ knownKanjiList: [...set] })
}

// TODO need a button to call this somewhere
export async function reloadKanjiSet() {
    const notes = await AnkiConnect.call("notesInfo", { query: knownKanjiAnkiQuery })
    localKanjiSet = new Set<string>()
    for (const note of notes) {
        // TODO use configured field name here
        const kanji = note.fields["Kanji"]?.value
        if (kanji) localKanjiSet.add(kanji)
    }
    await BrowserStorage.local.set({ knownKanjiList: [...localKanjiSet] })
}