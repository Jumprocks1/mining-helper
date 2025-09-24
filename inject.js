/// <reference path="types.d.ts" />

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

const downloadBytes = async (bytes, name) => downloadBlob(new Blob([bytes]), name)
const downloadBlob = async (blob, name) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const downloadAudio = async (audio, name) => {
    preload_audio([audio])
    const fetched = await fetches[audio]
    downloadBytes(fetched[0], name)
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

/**
 * @param {HTMLAnchorElement} exampleAudioAnchor 
 */
function logCard(exampleAudioAnchor) {
    const vocab = exampleAudioAnchor.closest(".vocabulary")
    const wordAudioAnchor = vocab.querySelector("*[data-audio].vocabulary-audio")
    const wordRuby = vocab.querySelector(".spelling ruby.v")

    const [kanji, furigana] = kanjiAndFurigana(wordRuby)

    const usedIn = exampleAudioAnchor.parentElement.querySelector("div.used-in")
    const jpSentence = kanjiAndFurigana(usedIn.querySelector("div.jp"))
    const enSentence = usedIn.querySelector("div.en").textContent

    const audio = wordAudioAnchor.dataset.audio.split(",")[0]
    const audioLocalFile = `${kanji}_${audio.replace("/", "_")}.ogg`

    const sentenceAudio = exampleAudioAnchor.dataset.audio.split(",")[0]
    const sentenceAudioLocalFile = `${kanji}_ex_${sentenceAudio.replace("/", "_")}.ogg`

    preload_audio([audio, sentenceAudio])

    const o = {
        audioLocalFile,
        sentenceAudioLocalFile,
        kanji,
        furigana,
        jpSentenceKanji: jpSentence[0],
        jpSentenceFuri: jpSentence[1],
        enSentence
    }

    console.log(o);

    (async () => {
        const zipFileWriter = new zip.BlobWriter();
        const zipWriter = new zip.ZipWriter(zipFileWriter);

        const audioBytes = (await fetches[audio])[0]
        const sentenceAudioBytes = (await fetches[sentenceAudio])[0]

        if (audioBytes)
            await zipWriter.add(audioLocalFile, new zip.BlobReader(new Blob([audioBytes])))
        else console.error(`audio not found ${audio}`)
        if (sentenceAudioBytes)
            await zipWriter.add(sentenceAudioLocalFile, new zip.BlobReader(new Blob([sentenceAudioBytes])))
        else console.error(`sentence audio not found ${audio}`)

        await zipWriter.close();
        await downloadBlob(await zipFileWriter.getData(), "jpdb.zip")
    })()



    return o
}

const load = () => {
    const audioTags = Array.from(document.querySelectorAll("*[data-audio].example-audio"));
    audioTags.forEach(e => {
        e.addEventListener("click", async ev => {
            if (ev.shiftKey || ev.ctrlKey) {
                ev.preventDefault()
                ev.stopImmediatePropagation()
                ev.stopPropagation()
                logCard(e)
                // await downloadAudio(e.dataset.audio, name)
            }
        }, true)
    })
    document.addEventListener("virtual-refresh", load)
}

if (document.readyState === "complete" || document.readyState === "interactive") {
    load()
} else {
    document.addEventListener("DOMContentLoaded", () => load())
}
