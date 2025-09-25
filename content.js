/// <reference path="types.d.ts" />

const style = `
`

const target = document.head || document.documentElement


/**
 * @param {ArrayBuffer} bytes 
 * @param {string} name 
 */
const downloadBytes = async (bytes, name) => downloadBlob(new Blob([bytes]), name)
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
async function downloadPendingCards() {
    const count = (await chrome.storage.session.get({ cardCount: 0 })).cardCount
    if (!count) return
    const request = []
    for (let i = 0; i < count; i++)
        request.push("card" + i)
    const cardsObject = await chrome.storage.session.get(request)
    chrome.storage.session.clear()
    /** @type {CardData[]} */
    const cards = []
    for (let i = 0; i < count; i++)
        cards.push(cardsObject["card" + i])


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

document.addEventListener("sentence-selected", async e => {
    const count = (await chrome.storage.session.get({ "cardCount": 0 })).cardCount
    // @ts-ignore
    chrome.storage.session.set({ ["card" + count]: e.detail.data, cardCount: count + 1 })
})

document.addEventListener("keypress", e => {
    if (e.ctrlKey && e.shiftKey && e.code === "KeyS") {
        downloadPendingCards()
    }
})


const css = document.createElement("style")
css.innerHTML = style
target.prepend(css)

zip.configure({ useWebWorkers: false }) // these break everything, not sure why
