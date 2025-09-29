import AnkiConnect, { MediaAdd } from "./anki-connect"
import { CardData, createElement, furiToReading } from "./util"


const anki = new AnkiConnect()

async function handleErrors(func: () => void | Promise<void>) {
    try {
        return await func()
    } catch (e) {
        showError((e as Error).message)
    }
}

function showError(err: string) {
    const errorDiv = document.getElementById("last-error")
    if (!errorDiv) return
    errorDiv.textContent = err
    errorDiv.classList.remove("hide")
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

async function update(card: CardData) {
    const notes = await anki.callAny("findNotes", { query: `word:*${card.kanji}*` })
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

async function save(card: CardData) {
    const [fields, audio] = activeFields(card);
    const noteId = await anki.call("addNote", {
        note: {
            deckName: anki.targetDeck,
            modelName: anki.targetModel,
            fields,
            audio,
            tags: ["ext-mined"]
        }
    })
    await anki.call("guiBrowse", { query: "added:1" })
    const cards = await anki.call("findCards", { query: `nid:${noteId}` })
    const cardId = cards.length > 0 && cards[0]
    if (cardId)
        await anki.call("guiSelectCard", { card: cardId })
}

document.addEventListener("DOMContentLoaded", () => {
    async function refresh() {
        const container = document.getElementById("card-container")
        if (!container) return
        const cardsObject = await chrome.storage.session.get()
        const cards: CardData[] = []
        for (const key in cardsObject)
            cards.push(cardsObject[key])
        cards.sort((a, b) => a.modified - b.modified)
        const newChildren = cards.map(e => {
            return createElement("div", {
                className: "card-row",
                children: [
                    createElement("span", { className: "kanji", textContent: e.kanji, tooltip: furiToReading(e.furigana) }),
                    "-",
                    e.meaningIndex ?
                        createElement("span", { className: "meaning-index", textContent: `m_${e.meaningIndex}`, tooltip: e.meaning })
                        : "",
                    createElement("span", {
                        className: "sentence-index", textContent: `ex_${e.sentenceIndex}`,
                        tooltip: [
                            createElement("div", { innerHTML: e.jpSentenceKanji }),
                            createElement("div", { textContent: e.enSentence })
                        ]
                    }),
                    createElement("div", { className: "flex-spacer" }),
                    createElement("span", {
                        className: "delete-button button", textContent: "x", onClick: async ev => {
                            ev.preventDefault()
                            await chrome.storage.session.remove(e.kanji)
                            refresh()
                        }
                    }),
                    createElement("span", {
                        className: "save-button button", textContent: "save", onClick: async ev => {
                            ev.preventDefault()
                            handleErrors(() => save(e))
                        }
                    }),
                    createElement("span", {
                        className: "update-button button", textContent: "up", onClick: async ev => {
                            ev.preventDefault()
                            handleErrors(() => update(e))
                        }
                    }),
                    createElement("a", {
                        className: "sentence-search button", textContent: "ss",
                        href: "https://sentencesearch.neocities.org/#" + e.kanji
                    })
                ]
            })
        })
        container.replaceChildren(...newChildren)
    }
    refresh()
})
