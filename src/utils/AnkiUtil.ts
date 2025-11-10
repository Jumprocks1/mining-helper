import { addAnkiWord } from "../anki/CardList"
import AnkiConnect, { MediaAdd } from "./AnkiConnect"
import UserError from "./UserError";
import { CardData, furiToReading } from "./util"

const anki = new AnkiConnect()

export async function saveToAnkiAndRemove(card: CardData, source?: "mining-modal") {
    const [fields, audio] = activeFields(card);
    const tags = ["ext-mined"]
    if (source) tags.push(source)
    const noteId = await anki.call("addNote", {
        note: {
            deckName: anki.targetDeck,
            modelName: anki.targetModel,
            fields,
            audio,
            tags
        }
    })
    await addAnkiWord(card.kanji) // could probably skip awaiting this
    await anki.call("guiBrowse", { query: "added:1" })
    const cards = await anki.call("findCards", { query: `nid:${noteId}` })
    const cardId = cards.length > 0 && cards[0]
    if (cardId)
        await anki.call("guiSelectCard", { card: cardId })
    await chrome.storage.session.remove(card.kanji)
}

export async function updateInAnkiAndRemove(card: CardData) {
    await updateInAnki(card)
    await chrome.storage.session.remove(card.kanji)
}


function activeFields(card: CardData) {
    // not sure how undefined behaves, so we filters those out first
    const tryFields = {
        ["Word"]: card.kanji,
        ["Word Reading"]: furiToReading(card.furigana),
        ["Word Meaning"]: card.meaning,
        ["Word Furigana"]: card.furigana,
        ["Sentence"]: card.jpSentenceKanji,
        ["Sentence Meaning"]: card.enSentence,
        ["Sentence Furigana"]: card.jpSentenceFuri,
    }
    const fields: Record<string, string> = {}
    for (const key in tryFields) {
        const v = tryFields[key as keyof typeof tryFields]
        if (v) fields[key] = v
    }
    const audio: MediaAdd[] = []
    function tryAddAudio(field: string, localFile: string | undefined, bytes: ArrayBuffer | undefined) {
        if (bytes && !localFile) throw new UserError("Missing audio file name")
        if (localFile && bytes) {
            audio.push({
                // @ts-ignore
                data: new Uint8Array(bytes).toBase64(),
                filename: localFile,
                fields: [field]
            })
            fields[field] = "" // have to reset field so it doesn't add duplicate audio
        }
    }
    tryAddAudio("Word Audio", card.audioLocalFile, card.audioBytes)
    tryAddAudio("Sentence Audio", card.sentenceAudioLocalFile, card.sentenceAudioBytes)
    return [fields, audio] as const
}

async function updateInAnki(card: CardData) {
    const notes = await anki.call("findNotes", { query: `word:${card.kanji}` })
    if (notes.length === 0) throw new Error(`No notes matching ${card.kanji}`)
    if (notes.length > 1) throw new Error(`Multiple notes matching ${card.kanji}`)
    const noteId = notes[0]

    const [fields, audio] = activeFields(card);
    // not allowed to update these for now
    delete fields["Word"]
    delete fields["Word Reading"]
    delete fields["Word Furigana"]
    await anki.call("updateNote", {
        note: {
            id: noteId,
            fields,
            audio
        }
    })
    await anki.call("guiBrowse", { query: "edited:1" })
    const cards = await anki.call("findCards", { query: `nid:${noteId}` })
    const cardId = cards.length > 0 && cards[0]
    if (cardId)
        await anki.call("guiSelectCard", { card: cardId })
}