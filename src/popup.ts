import { createElement, furiToReading } from "./util"

document.addEventListener("DOMContentLoaded", () => {
    async function refresh() {
        const container = document.getElementById("card-container")
        if (!container) return
        const keys = await chrome.storage.session.getKeys()
        const cardsObject = await chrome.storage.session.get(keys)
        /** @type {CardData[]} */
        const cards = []
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
