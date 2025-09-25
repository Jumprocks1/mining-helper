/// <reference path="types.d.ts" />

const style = `
.subsection-meanings .description:hover:not(.selected),
    .subsection-examples .used-in:hover:not(.selected) {
    background-color: oklch(0.7012 0.1888 143.23 / 15%);
    cursor: pointer;
}
.subsection-meanings .description.selected,
    .subsection-examples .used-in.selected {
    background-color: oklch(0.7012 0.1888 22.97 / 15%);
}
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

document.addEventListener("sentence-selected", async e => {
    /** @type {CardData} */
    // @ts-ignore
    const data = e.detail.data
    chrome.storage.session.set({ [data.kanji]: data })
    console.log(data)
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
