import { addAnkiWord } from "./anki/CardList"
import MhHeader from "./components/MhHeader"
import { seedPage } from "./components/util"
import AnkiConnect, { MediaAdd } from "./utils/AnkiConnect"
import { CardData, oldCreateElement, furiToReading } from "./utils/util"


const anki = new AnkiConnect()

const resultDiv = <div id="result" className="hide" />
function clearResult() {
    resultDiv.classList = "hide"
}
function showError(err: string) {
    resultDiv.textContent = err
    resultDiv.classList = "error"
}
function showMessage(message: string) {
    resultDiv.textContent = message
    resultDiv.classList = "success"
}

async function handleErrors(func: () => void | Promise<void>, message = "Success") {
    try {
        clearResult()
        await func()
        showMessage(message)
    } catch (e) {
        showError((e as Error).message)
    }
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
    const notes = await anki.call("findNotes", { query: `word:*${card.kanji}*` })
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

const cardContainer = <div id="card-container" />

document.addEventListener("DOMContentLoaded", () => {
    seedPage("popup-page", [
        MhHeader(),
        <div id="body-container">
            <h2>Pending Cards</h2>
            {cardContainer}
            {resultDiv}
        </div>
    ])

    async function saveAndRemove(card: CardData) {
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
        await addAnkiWord(card.kanji) // could probably skip awaiting this
        await anki.call("guiBrowse", { query: "added:1" })
        const cards = await anki.call("findCards", { query: `nid:${noteId}` })
        const cardId = cards.length > 0 && cards[0]
        if (cardId)
            await anki.call("guiSelectCard", { card: cardId })
        await chrome.storage.session.remove(card.kanji)
        refresh()
    }

    const popup = new URLSearchParams(location.search).get("p") !== null
    if (popup) document.body.classList.add("popup")
    async function refresh() {
        const cardsObject = await chrome.storage.session.get()
        const cards: CardData[] = []
        for (const key in cardsObject)
            cards.push(cardsObject[key])
        cards.sort((a, b) => a.modified - b.modified)
        const newChildren = cards.map(e => {
            return oldCreateElement("div", {
                className: "card-row",
                children: [
                    oldCreateElement("span", { className: "kanji", textContent: e.kanji, tooltip: furiToReading(e.furigana) }),
                    "-",
                    e.meaningIndex ?
                        oldCreateElement("span", { className: "meaning-index", textContent: `m_${e.meaningIndex}`, tooltip: e.meaning })
                        : "",
                    oldCreateElement("span", {
                        className: "sentence-index", textContent: `ex_${e.sentenceIndex}`,
                        tooltip: [
                            oldCreateElement("div", { innerHTML: e.jpSentenceKanji }),
                            oldCreateElement("div", { textContent: e.enSentence })
                        ]
                    }),
                    oldCreateElement("div", { className: "flex-spacer" }),
                    oldCreateElement("span", {
                        className: "delete-button button", textContent: "x", onClick: async ev => {
                            ev.preventDefault()
                            await chrome.storage.session.remove(e.kanji)
                            refresh()
                        }
                    }),
                    oldCreateElement("span", {
                        className: "save-button button", textContent: "save", onClick: async ev => {
                            ev.preventDefault()
                            handleErrors(() => saveAndRemove(e), "Saved")
                        }
                    }),
                    oldCreateElement("span", {
                        className: "update-button button", textContent: "up", onClick: async ev => {
                            ev.preventDefault()
                            handleErrors(() => update(e), "Updated")
                        }
                    }),
                    oldCreateElement("a", {
                        className: "sentence-search button", textContent: "ss",
                        href: "https://sentencesearch.neocities.org/#" + e.kanji
                    })
                ]
            })
        })
        cardContainer.replaceChildren(...newChildren)
    }
    refresh()

    if (popup) {
        document.addEventListener("click", ev => {
            const target = ev.target as HTMLAnchorElement | null
            if (target && target.matches("#mh-header a.button")) {
                chrome.tabs.create({ url: chrome.runtime.getURL(target.getAttribute("href")!) });
                ev.preventDefault()
            }
        })
    }
})
