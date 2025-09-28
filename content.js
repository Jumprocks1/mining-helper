/// <reference path="types.d.ts" />

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

/** @type {{[key in number]: (value: any) => void}} */
const pendingAudioRequests = {}
document.addEventListener("fetch-audio-response", ev => {
    /** @type {CustomEvent} */
    // @ts-ignore
    const customEv = ev
    pendingAudioRequests[customEv.detail.requestId](customEv.detail.audios)
})
let requestId = 0
/**
 * 
 * @param {string[]} audios 
 * @returns {Promise<ArrayBuffer[]>}
 */
async function requestAudio(audios) {
    const myId = requestId++
    return await new Promise(res => {
        pendingAudioRequests[myId] = res
        document.dispatchEvent(new CustomEvent("fetch-audio", {
            detail: { audios, requestId: myId }
        }))
    })
}

function furiToReading(s) {
    let o = ""
    for (let i = 0; i < s.length; i++) {
        const c = s[i]
        if (c === "[")
            o = o.substring(0, o.length - 1)
        else if (c !== "]")
            o += c
    }
    return o
}

/**
 * @param {Blob} blob
 * @param {string} name 
 */
const downloadBlob = async (blob, name) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** @param {string} s */
const sound = s => `[sound:${s}]`

/** @param {CardData[]} cards */
function csv(cards) {
    /** @type {{name:string, get: (e: CardData) => string}[]} */
    const fields = [
        { name: "Word", get: e => e.kanji },
        { name: "Word Reading", get: e => furiToReading(e.furigana) },
        { name: "Word Meaning", get: e => e.meaning },
        { name: "Word Furigana", get: e => e.furigana },
        { name: "Word Audio", get: e => sound(e.audioLocalFile) },
        { name: "Sentence", get: e => e.jpSentenceKanji },
        { name: "Sentence Meaning", get: e => e.enSentence },
        { name: "Sentence Furigana", get: e => e.jpSentenceFuri },
        { name: "Sentence Audio", get: e => sound(e.sentenceAudioLocalFile) },
        // TODO add sentence hash as ID or something
    ]
    let o = ""
    o += "#separator:Pipe\n"
    o += "#html:true\n"
    o += "#columns:"
    for (let i = 0; i < fields.length; i++) {
        o += fields[i].name
        if (i < fields.length - 1) o += "|"
    }
    o += "\n"
    for (const card of cards) {
        for (let i = 0; i < fields.length; i++) {
            o += fields[i].get(card)
            if (i < fields.length - 1) o += "|"
        }
        o += "\n"
    }
    return o
}

// TODO should move this to service worker?
async function downloadPendingCards() {
    const keys = await chrome.storage.session.getKeys()
    const cardsObject = await chrome.storage.session.get(keys)
    chrome.storage.session.clear()
    /** @type {CardData[]} */
    const cards = []
    for (const key in cardsObject)
        cards.push(cardsObject[key])


    const csvString = csv(cards)
    const zipFileWriter = new zip.BlobWriter();
    const zipWriter = new zip.ZipWriter(zipFileWriter);

    await zipWriter.add("cards.csv", new zip.TextReader(csvString))

    for (const card of cards) {
        if (card.audioBytes)
            await zipWriter.add(card.audioLocalFile, new zip.BlobReader(new Blob([card.audioBytes])))
        if (card.sentenceAudioBytes)
            await zipWriter.add(card.sentenceAudioLocalFile, new zip.BlobReader(new Blob([card.sentenceAudioBytes])))
    }

    await zipWriter.close();
    await downloadBlob(await zipFileWriter.getData(), "jpdb.zip")
}

document.addEventListener("keypress", e => {
    if (e.ctrlKey && e.shiftKey && e.code === "KeyS") {
        downloadPendingCards()
    }
})


const css = document.createElement("style")
css.innerHTML = style
target.prepend(css)

zip.configure({ useWebWorkers: false }) // these break everything, not sure why

/**
 * @param {string} css
 * @param {HTMLElement} node
 */
function select(css, node) {
    const all = document.querySelectorAll(css)
    for (const e of all) e.classList.remove("selected")
    node.classList.add("selected")
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

/** @param {Node} node */
function kanjiAndFurigana(node, o = ["", ""]) {
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
                        }
                    }
                }
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

async function storeCard() {
    const sentenceElement = document.querySelector(sentenceCss + ".selected") ?? document.querySelector(sentenceCss)
    select(sentenceCss, sentenceElement)

    const exampleAudioAnchor = sentenceElement.parentElement.querySelector("*[data-audio].example-audio")
    const vocab = sentenceElement.closest(".vocabulary")
    const wordAudioAnchor = vocab.querySelector("*[data-audio].vocabulary-audio")
    const wordRuby = vocab.querySelector(".spelling ruby.v")

    const [kanji, furigana] = kanjiAndFurigana(wordRuby)

    const jpSentence = kanjiAndFurigana(sentenceElement.querySelector("div.jp"))
    const enSentence = sentenceElement.querySelector("div.en").textContent

    const audio = wordAudioAnchor.dataset.audio.split(",")[0]
    const audioLocalFile = `${kanji}_${audio.replace("/", "_")}.ogg`

    const sentenceAudio = exampleAudioAnchor.dataset.audio.split(",")[0]
    const sentenceAudioLocalFile = `${kanji}_ex_${sentenceAudio.replace("/", "_")}.ogg`

    const meaningElement = vocab.querySelector(meaningCss + ".selected") ?? vocab.querySelector(meaningCss)
    select(meaningCss, meaningElement)
    let description = meaningElement.childNodes[0].textContent
    description = description.replace(/^\d+\./, "").trim()

    const [audioBytes, sentenceAudioBytes] = await requestAudio([audio, sentenceAudio])

    /** @type {CardData} */
    const cardData = {
        audioLocalFile,
        meaning: description,
        sentenceAudioLocalFile,
        kanji,
        furigana,
        jpSentenceKanji: jpSentence[0],
        jpSentenceFuri: jpSentence[1],
        enSentence,
        // surprisingly these ArrayBuffers are serializable
        audioBytes,
        sentenceAudioBytes,
        meaningIndex: "jpdb_" + [...document.querySelectorAll(meaningCss)].indexOf(meaningElement),
        sentenceIndex: "jpdb_" + [...document.querySelectorAll(sentenceCss)].indexOf(sentenceElement),
        modified: Date.now()
    }
    chrome.storage.session.set({ [cardData.kanji]: cardData })
    console.log(cardData)
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
        if (check(meaningCss) || check(sentenceCss))
            storeCard()
    }
})