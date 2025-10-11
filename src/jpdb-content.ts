import { getAnkiWords } from "./anki/CardList"
import { handleKeypress, keyPressedWithText } from "./utils/GlobalHotkeys"
import { CardData } from "./utils/util"

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

.vocabulary:has(.tag:is(.blacklisted, .known, .overdue)) .primary-spelling > .spelling > div
{
    background: oklch(54.017% 0.13237 263.851 / 0.30);
}

.vocabulary.has-anki-card .primary-spelling > .spelling > div {
    background: oklch(0.7012 0.1888 143.23 / 40%) !important;
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
    const allAnkiWords = await getAnkiWords()
    const vocabs = document.querySelectorAll(".vocabulary")
    for (const vocab of vocabs) {
        const wordRuby = vocab.querySelector<HTMLElement>(".spelling ruby.v")
        if (wordRuby) {
            const [kanji,] = kanjiAndFurigana(wordRuby)
            if (allAnkiWords.includes(kanji)) {
                vocab.classList.add("has-anki-card")
                const target = vocab.querySelector<HTMLElement>(".primary-spelling > .spelling > div")
                if (target) target.title = "Already has Anki card with this exact word field"
            }
            const res = await chrome.storage.session.get(kanji)
            const stored: CardData = res[kanji]
            if (stored) {
                if (stored.meaningIndex && stored.meaningIndex.startsWith("jpdb_"))
                    select(meaningCss, document.querySelectorAll<HTMLElement>(meaningCss).item(parseInt(stored.meaningIndex.substring(5))))
                if (stored.sentenceIndex && stored.sentenceIndex.startsWith("jpdb_"))
                    select(sentenceCss, document.querySelectorAll<HTMLElement>(sentenceCss).item(parseInt(stored.sentenceIndex.substring(5))))
            }
        }
    }
}

function kanjiAndFurigana(node: ChildNode, o = ["", ""]) {
    if (node.nodeType === 3) {
        o[0] += node.textContent
        o[1] += node.textContent
    } else {
        if (node.nodeName === "RT") {
            throw new Error("Unexpected <rt>")
        } else if (node.nodeName === "RUBY") {
            if (node.childNodes.length === 0) { }
            else if (node.childNodes.length === 1) {
                kanjiAndFurigana(node.childNodes[0])
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
        } else if ((node as HTMLElement).classList.contains("highlight")) {
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

let latestWord: string | undefined = undefined

async function storeCard(clicked: HTMLElement) {
    const sentenceElement = document.querySelector<HTMLElement>(sentenceCss + ".selected") ?? document.querySelector(sentenceCss)
    select(sentenceCss, sentenceElement)

    const vocab = clicked.closest(".vocabulary")

    if (!vocab) return

    const wordRuby = vocab.querySelector(".spelling ruby.v")
    if (!wordRuby) return

    const [kanji, furigana] = kanjiAndFurigana(wordRuby)
    latestWord = kanji




    const o: CardData = {
        kanji,
        furigana,
        modified: Date.now()
    }

    const meaningElement = vocab.querySelector<HTMLElement>(meaningCss + ".selected") ?? vocab.querySelector<HTMLElement>(meaningCss)
    if (meaningElement) {
        select(meaningCss, meaningElement)
        let description = meaningElement.childNodes[0].textContent?.replace(/^\d+\./, "").trim()
        if (description) o.meaning = description;
        o.meaningIndex = "jpdb_" + [...document.querySelectorAll(meaningCss)].indexOf(meaningElement);
    }

    let audio = undefined

    const wordAudioAnchor = vocab.querySelector<HTMLElement>("*[data-audio].vocabulary-audio")
    if (wordAudioAnchor) {
        audio = wordAudioAnchor.dataset.audio!.split(",")[0]
        const audioLocalFile = `${kanji}_${audio.replace("/", "_")}.ogg`
        o.audioLocalFile = audioLocalFile
    }

    let sentenceAudio = undefined

    if (sentenceElement) {
        const jpEl = sentenceElement.querySelector("div.jp");
        if (jpEl) {
            const jpSentence = kanjiAndFurigana(jpEl)
            o.jpSentenceKanji = jpSentence[0]
            o.jpSentenceFuri = jpSentence[1]
        }
        o.enSentence = sentenceElement.querySelector("div.en")?.textContent
        o.sentenceIndex = "jpdb_" + [...document.querySelectorAll(sentenceCss)].indexOf(sentenceElement)

        const sentenceAudioAnchor = sentenceElement.parentElement?.querySelector<HTMLElement>("*[data-audio].example-audio")
        if (sentenceAudioAnchor) {
            sentenceAudio = sentenceAudioAnchor.dataset.audio!.split(",")[0]
            o.sentenceAudioLocalFile = `${kanji}_ex_${sentenceAudio.replace("/", "_")}.ogg`
        }
    }

    if (sentenceAudio && audio) {
        const [audioBytes, sentenceAudioBytes] = await requestAudio([audio, sentenceAudio])
        o.audioBytes = audioBytes
        o.sentenceAudioBytes = sentenceAudioBytes
    } else if (audio) {
        const [audioBytes,] = await requestAudio([audio,])
        o.audioBytes = audioBytes
    }

    chrome.storage.session.set({ [o.kanji]: o })
    console.log(o)
}

document.addEventListener("click", ev => {
    const clicked = ev.target as HTMLElement | null
    if (clicked) {
        const check = (css: string) => {
            const found = clicked.closest<HTMLElement>(css)
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

document.addEventListener("keypress", ev => {
    if (handleKeypress(ev)) return

    let target = latestWord
    if (!target) {
        const meaning = document.querySelector<HTMLElement>(meaningCss + ".selected") ?? document.querySelector<HTMLElement>(meaningCss)
        const vocab = meaning?.closest(".vocabulary")
        if (vocab) {
            const wordRuby = vocab.querySelector(".spelling ruby.v")
            if (wordRuby) {
                const [kanji,] = kanjiAndFurigana(wordRuby)
                if (kanji)
                    target = kanji
            }
        }
    }
    if (target && keyPressedWithText(ev, target)) return
})