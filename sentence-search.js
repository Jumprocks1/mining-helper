/// <reference path="types.d.ts" />
/// <reference path="chrome.d.ts" />

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

/** @param {CardData} card */
async function lookupFuri(card) {
    const s = card.jpSentenceKanji
    const res = await fetch("https://jpdb.io/api/v1/parse", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text: s,
            token_fields: [
                "position",
                "length",
                "furigana"
            ],
            position_length_encoding: "utf16"
        })
    })
    const json = await res.json()
    // TODO we could get the furi for the kanji, but for now that will come from jpdb mining
    // const targetLeft = card.jpSentenceKanji.indexOf(card.kanji)
    // const targetRight = targetLeft + card.kanji.length
    let wordFuri = ""
    let o = ""
    for (const token of json.tokens) {
        const [position, length, furi] = token
        const left = position
        const right = position + length
        if (furi === null) {
            o += s.substring(position, length)
        }
        else {
            for (const part of furi) {
                if (!Array.isArray(part)) {
                    o += part
                } else {
                    if (o.length > 0) {
                        const prev = o[o.length - 1]
                        if (prev !== "]" && prev !== ">")
                            o += " "
                    }
                    o += `${part[0]}[${part[1]}]`
                }
            }
        }
    }
    card.jpSentenceFuri = o
    if (!card.furigana) card.furigana = wordFuri
}

async function urlToArrayBuffer(url) {
    // TODO skip CORS with header mod
    const res = await fetch(url)
    return await (await res.blob()).arrayBuffer()
}

async function updateCard() {
    const sentenceElement = document.querySelector(sentenceCss + ".selected") ?? document.querySelector(sentenceCss)
    const searchInput = document.getElementById("searchInput")
    const kanji = searchInput.value
    /** @type {CardData} */
    const card = (await chrome.storage.session.get({ [kanji]: {} }))[kanji]
    card.kanji = kanji
    card.jpSentenceKanji = sentenceElement.querySelector(".jap").textContent
    card.enSentence = sentenceElement.querySelector(".eng").textContent
    const audioUrl = sentenceElement.querySelector("a.audioDownload").href
    card.sentenceAudioBytes = await urlToArrayBuffer(audioUrl)
    card.sentenceAudioLocalFile = `${card.kanji}_ex_sentencesearch.ogg`
    card.sentenceIndex = "ss_" + [...document.querySelectorAll(sentenceCss)].indexOf(sentenceElement)

    await lookupFuri(card)

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