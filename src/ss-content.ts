import { CardData, lookupFuri, urlToArrayBuffer } from "./util";

export { }

const sentenceCss = "#search-results-list>.search-result"

const style = `
${sentenceCss}:hover:not(.selected) {
    background-color: oklch(0.7012 0.1888 143.23 / 15%);
    cursor: pointer;
}
${sentenceCss}.selected {
    background-color: oklch(0.7012 0.1888 22.97 / 15%);
}
`

const css = document.createElement("style")
css.innerHTML = style;
(document.head || document.documentElement).prepend(css)

async function updateCard() {
    const sentenceElement = document.querySelector(sentenceCss + ".selected") ?? document.querySelector(sentenceCss)
    const searchInput = document.getElementById("searchInput") as HTMLInputElement
    if (!sentenceElement || !searchInput) return

    const keys = await chrome.storage.session.getKeys()
    let kanji = searchInput.value
    const foundKey = keys.find(e => e.includes(kanji))
    if (foundKey) kanji = foundKey

    const card: CardData = (await chrome.storage.session.get({ [kanji]: {} }))[kanji]
    card.kanji = kanji
    card.jpSentenceKanji = sentenceElement.querySelector(".jap")?.textContent
    card.enSentence = sentenceElement.querySelector(".eng")?.textContent
    const audioUrl = sentenceElement.querySelector<HTMLAnchorElement>("a.audioDownload")?.href
    card.sentenceAudioBytes = await urlToArrayBuffer(audioUrl)
    card.sentenceAudioLocalFile = `${card.kanji}_ex_sentencesearch.ogg`
    card.sentenceIndex = "ss_" + [...document.querySelectorAll(sentenceCss)].indexOf(sentenceElement)

    card.jpSentenceFuri = await lookupFuri(card.jpSentenceKanji)

    console.log(card)
    chrome.storage.session.set({ [kanji]: card })
}

function select(css, node) {
    const all = document.querySelectorAll(css)
    for (const e of all) e.classList.remove("selected")
    node.classList.add("selected")
}
document.addEventListener("click", ev => {
    /** @type {HTMLElement} */
    const clicked = ev.target
    if (clicked) {
        if (clicked.closest("a")) return // ignore if we clicked an anchor
        const found = clicked.closest(sentenceCss)
        if (found) {
            select(sentenceCss, found)
            updateCard()
        }
    }
})