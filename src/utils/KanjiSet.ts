import AnkiConnect from "./AnkiConnect"
import { BrowserStorage } from "./BrowserApi"

type KanjiSet = Set<string> // single characters

let localAnkiKanjiSet: KanjiSet | undefined

const knownKanjiAnkiQuery = `"deck:Mining Helper Kanji" -is:suspended`

export async function loadAnkiKanjiSet(disableCache = false) {
    if (!disableCache && localAnkiKanjiSet) return localAnkiKanjiSet
    const list = (await BrowserStorage.local.get({ knownAnkiKanji: "" })).knownAnkiKanji
    localAnkiKanjiSet = new Set(list)
    return localAnkiKanjiSet
}

export async function addKnownAnkiKanji(kanji: string) {
    const set = await loadAnkiKanjiSet()
    set.add(kanji)
    await BrowserStorage.local.set({ knownAnkiKanji: [...set].join("") })
}

// TODO need a button to call this somewhere
export async function reloadAnkiKanjiSet() {
    const notes = await AnkiConnect.call("notesInfo", { query: knownKanjiAnkiQuery })
    localAnkiKanjiSet = new Set<string>()
    for (const note of notes) {
        // TODO use configured field name here
        const kanji = note.fields["Kanji"]?.value
        if (kanji) localAnkiKanjiSet.add(kanji)
    }
    await BrowserStorage.local.set({ knownAnkiKanji: [...localAnkiKanjiSet].join("") })
}