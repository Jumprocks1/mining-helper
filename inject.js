/// <reference path="types.d.ts" />
// @ts-nocheck

const originalFetch = fetch;
const fetches = {}
window.fetch = (...args) => {
    const input = args[0]
    const res1 = originalFetch.apply(window, args)
    const prefix = "/static/v/"
    if (typeof input === "string" && input.startsWith(prefix)) {
        const audio = input.substring(prefix.length)
        // console.log(`fetch ${audio}`)
        const originalThen1 = res1.then
        res1.then = (...args1) => {
            const res2 = originalThen1.apply(res1, args1)
            const originalThen2 = res2.then
            res2.then = (...args2) => fetches[audio] = originalThen2.apply(res2, args2)
            return res2
        }
    }
    return res1
}

/**
 * @param {HTMLElement} node
 */
function kanjiAndFurigana(node, o = ["", ""]) {
    if (node.nodeType === 3) {
        o[0] += node.textContent
        o[1] += node.textContent
    } else {
        if (node.nodeName === "RT") {
            const text = node.textContent
            if (text) { // some of these are empty
                o[1] += "["
                o[1] += text
                o[1] += "]"
            }
        } else if (node.classList.contains("highlight")) {
            o[0] += "<b>"
            o[1] += "<b>";
            [...node.childNodes].forEach(e => kanjiAndFurigana(e, o))
            o[0] += "</b>"
            o[1] += "</b>"
        } else {
            [...node.childNodes].forEach(e => kanjiAndFurigana(e, o))
        }
    }
    return o
}

function logCard() {
    const usedInElement = document.querySelector(exampleCss + ".selected") ?? document.querySelector(exampleCss)
    select(exampleCss, usedInElement)

    const exampleAudioAnchor = usedInElement.parentElement.querySelector("*[data-audio].example-audio")
    const vocab = usedInElement.closest(".vocabulary")
    const wordAudioAnchor = vocab.querySelector("*[data-audio].vocabulary-audio")
    const wordRuby = vocab.querySelector(".spelling ruby.v")

    const [kanji, furigana] = kanjiAndFurigana(wordRuby)

    const jpSentence = kanjiAndFurigana(usedInElement.querySelector("div.jp"))
    const enSentence = usedInElement.querySelector("div.en").textContent

    const audio = wordAudioAnchor.dataset.audio.split(",")[0]
    const audioLocalFile = `${kanji}_${audio.replace("/", "_")}.ogg`

    const sentenceAudio = exampleAudioAnchor.dataset.audio.split(",")[0]
    const sentenceAudioLocalFile = `${kanji}_ex_${sentenceAudio.replace("/", "_")}.ogg`

    const descriptionElement = vocab.querySelector(descriptionCss + ".selected") ?? vocab.querySelector(descriptionCss)
    select(descriptionCss, descriptionElement)
    let description = descriptionElement.childNodes[0].textContent
    description = description.replace(/^\d+\./, "").trim()


    preload_audio([audio, sentenceAudio]);


    (async () => {
        /** @type {CardData} */
        const o = {
            audioLocalFile,
            meaning: description,
            sentenceAudioLocalFile,
            kanji,
            furigana,
            jpSentenceKanji: jpSentence[0],
            jpSentenceFuri: jpSentence[1],
            enSentence,
            // surprisingly these ArrayBuffers are serializable
            audioBytes: (await fetches[audio])[0],
            sentenceAudioBytes: (await fetches[sentenceAudio])[0]
        }
        const event = new CustomEvent("sentence-selected", {
            detail: {
                data: o,
            }
        })
        document.dispatchEvent(event)
    })()
}

const descriptionCss = ".subsection-meanings .description"
const exampleCss = ".subsection-examples .used-in"

const select = (css, node) => {
    const all = document.querySelectorAll(css)
    for (const e of all) e.classList.remove("selected")
    node.classList.add("selected")
}

document.addEventListener("click", ev => {
    /** @type {HTMLElement} */
    const clicked = ev.target
    if (clicked) {
        const check = (css) => {
            const found = clicked.closest(css)
            if (found) {
                select(css, found)
                // don't prevent default since selecting/copying is nice
                return found
            }
        }
        if (check(descriptionCss) || check(exampleCss))
            logCard()
    }
})

