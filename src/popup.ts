import AnkiConnect, { MediaAdd } from "./anki-connect"
import { CardData, createElement, furiToReading } from "./util"


const anki = new AnkiConnect()

async function save(card: CardData) {
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
        }
    }
    tryAddAudio("Word Audio", card.audioLocalFile, card.audioBytes)
    tryAddAudio("Sentence Audio", card.sentenceAudioLocalFile, card.sentenceAudioBytes)
    const res = await anki.call("addNote", {
        note: {
            deckName: anki.targetDeck,
            modelName: anki.targetModel,
            fields,
            audio
        }
    })
    await anki.call("guiBrowse", { query: "added:1" })
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
                children: [
                    createElement("span", { className: "kanji", textContent: e.kanji, tooltip: furiToReading(e.furigana) }),
                    " - ",
                    e.meaningIndex ?
                        createElement("span", { className: "meaning-index", textContent: `m_${e.meaningIndex}`, tooltip: e.meaning })
                        : "",
                    " ",
                    createElement("span", {
                        className: "sentence-index", textContent: `ex_${e.sentenceIndex}`,
                        tooltip: [
                            createElement("div", { innerHTML: e.jpSentenceKanji }),
                            createElement("div", { textContent: e.enSentence })
                        ]
                    }),
                    " ",
                    createElement("span", {
                        className: "delete-button", textContent: "x", onClick: async ev => {
                            ev.preventDefault()
                            await chrome.storage.session.remove(e.kanji)
                            refresh()
                        }
                    }),
                    " ",
                    createElement("span", {
                        className: "save-button", textContent: "save", onClick: async ev => {
                            ev.preventDefault()
                            save(e)
                        }
                    }),
                    " ",
                    createElement("a", {
                        className: "sentence-search", textContent: "ss",
                        href: "https://sentencesearch.neocities.org/#" + e.kanji
                    })
                ]
            })
        })
        container.replaceChildren(...newChildren)
    }
    refresh()
})
