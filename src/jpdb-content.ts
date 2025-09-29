import { CardData } from "./util"

export { }

const meaningCss = ".subsection-meanings .description"
const sentenceCss = ".subsection-examples .used-in:has(.en)"

const style = `
${meaningCss}:hover:not(.selected),
    ${sentenceCss}:hover:not(.selected) {
    background-color: oklch(0.7012 0.1888 143.23 / 15%);
    cursor: pointer;
}
${meaningCss}.selected,
    ${sentenceCss}.selected {
    background-color: oklch(0.7012 0.1888 22.97 / 15%);
}
`

const target = document.head || document.documentElement

const pendingAudioRequests: { [key in number]: (value: any) => void } = {}
document.addEventListener("fetch-audio-response", ev => {
    const customEv = ev as CustomEvent
    pendingAudioRequests[customEv.detail.requestId](customEv.detail.audios)
})
let requestId = 0
async function requestAudio(audios: string[]): Promise<ArrayBuffer[]> {
    const myId = requestId++
    return await new Promise(res => {
        pendingAudioRequests[myId] = res
        document.dispatchEvent(new CustomEvent("fetch-audio", {
            detail: { audios, requestId: myId }
        }))
    })
}

const css = document.createElement("style")
css.innerHTML = style
target.prepend(css)

function select(css: string, node: HTMLElement | undefined | null) {
    const all = document.querySelectorAll(css)
    for (const e of all) e.classList.remove("selected")
    if (node) node.classList.add("selected")
}

async function afterLoad() {
    const vocabs = document.querySelectorAll(".vocabulary")
    for (const vocab of vocabs) {
        const wordRuby = vocab.querySelector(".spelling ruby.v")
        if (wordRuby) {
            const [kanji,] = kanjiAndFurigana(wordRuby)
            const res = await chrome.storage.session.get(kanji)
            /** @type {CardData} */
            const stored = res[kanji]
            if (stored) {
                if (stored.meaningIndex && stored.meaningIndex.startsWith("jpdb_"))
                    select(meaningCss, document.querySelectorAll(meaningCss).item(parseInt(stored.meaningIndex.substring(5))))
                if (stored.sentenceIndex && stored.sentenceIndex.startsWith("jpdb_"))
                    select(sentenceCss, document.querySelectorAll(sentenceCss).item(stored.sentenceIndex.substring(5)))
            }
        }
    }
}

function kanjiAndFurigana(node: HTMLElement, o = ["", ""]) {
    if (node.nodeType === 3) {
        o[0] += node.textContent
        o[1] += node.textContent
    } else {
        if (node.nodeName === "RT") {
            throw new Error("Unexpected <rt>")
        } else if (node.nodeName === "RUBY") {
            if (node.childNodes.length === 0) { }
            else if (node.childNodes.length === 1) {
                kanjiAndFurigana(node.childNodes[0] as HTMLElement)
            } else {
                let pending = undefined
                for (let i = 0; i < node.childNodes.length; i++) {
                    const e = node.childNodes[i]
                    if (e.nodeType === 3) {
                        o[0] += pending = e.textContent
                    } else if (e.nodeName === "RT") {
                        const rt = e.textContent
                        if (rt) {
                            if (o[1].length > 0) {
                                const prev = o[1][o[1].length - 1]
                                if (prev !== "]" && prev !== ">")
                                    o[1] += " "
                            }
                            o[1] += pending
                            o[1] += `[${rt}]`
                            pending = undefined
                        } else {
                            o[1] += pending
                            pending = undefined
                        }
                    }
                }
                if (pending)
                    o[1] += pending
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
afterLoad()
document.addEventListener("virtual-refresh", afterLoad)

async function storeCard(clicked: HTMLElement) {
    const sentenceElement = document.querySelector<HTMLElement>(sentenceCss + ".selected") ?? document.querySelector(sentenceCss)
    select(sentenceCss, sentenceElement)

    const vocab = clicked.closest(".vocabulary")

    if (!vocab) return

    const wordAudioAnchor = vocab.querySelector("*[data-audio].vocabulary-audio")
    const wordRuby = vocab.querySelector(".spelling ruby.v")

    const [kanji, furigana] = kanjiAndFurigana(wordRuby)

    const audio = wordAudioAnchor.dataset.audio.split(",")[0]
    const audioLocalFile = `${kanji}_${audio.replace("/", "_")}.ogg`

    const meaningElement = vocab.querySelector(meaningCss + ".selected") ?? vocab.querySelector(meaningCss)
    select(meaningCss, meaningElement)
    let description = meaningElement.childNodes[0].textContent
    description = description.replace(/^\d+\./, "").trim()


    const o: CardData = {
        audioLocalFile,
        meaning: description,
        kanji,
        furigana,
        meaningIndex: "jpdb_" + [...document.querySelectorAll(meaningCss)].indexOf(meaningElement),
        modified: Date.now()
    }

    let sentenceAudio = undefined

    if (sentenceElement) {
        const jpSentence = kanjiAndFurigana(sentenceElement.querySelector("div.jp"))
        o.jpSentenceKanji = jpSentence[0]
        o.jpSentenceFuri = jpSentence[1]
        o.enSentence = sentenceElement.querySelector("div.en")?.textContent
        o.sentenceIndex = "jpdb_" + [...document.querySelectorAll(sentenceCss)].indexOf(sentenceElement)

        const sentenceAudioAnchor = sentenceElement.parentElement?.querySelector("*[data-audio].example-audio")
        if (sentenceAudioAnchor) {
            sentenceAudio = sentenceAudioAnchor.dataset.audio.split(",")[0]
            o.sentenceAudioLocalFile = `${kanji}_ex_${sentenceAudio.replace("/", "_")}.ogg`
        }
    }

    if (sentenceAudio) {
        const [audioBytes, sentenceAudioBytes] = await requestAudio([audio, sentenceAudio])
        o.audioBytes = audioBytes
        o.sentenceAudioBytes = sentenceAudioBytes


    } else {
        const [audioBytes,] = await requestAudio([audio,])
        o.audioBytes = audioBytes
    }

    chrome.storage.session.set({ [o.kanji]: o })
    console.log(o)
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
        const found = check(meaningCss) || check(sentenceCss)
        if (found)
            storeCard(found)
    }
})