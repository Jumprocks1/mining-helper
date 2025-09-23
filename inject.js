const originalFetch = fetch;
const fetches = {}
window.fetch = (...args) => {
    const input = args[0]
    const res1 = originalFetch.apply(window, args)
    const prefix = "/static/v/"
    if (typeof input === "string" && input.startsWith(prefix)) {
        const audio = input.substring(prefix.length)
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

const downloadBytes = async (bytes, name) => {
    const blob = new Blob([bytes]);
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name + ".ogg"
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
    const wordRuby = exampleAudioAnchor.closest(".vocabulary").querySelector(".spelling ruby.v")
    const [kanji, furigana] = kanjiAndFurigana(wordRuby)

    const usedIn = exampleAudioAnchor.parentElement.querySelector("div.used-in")
    const jpSentence = kanjiAndFurigana(usedIn.querySelector("div.jp"))
    const enSentence = usedIn.querySelector("div.en").textContent

    // const audioName = kanji

    console.log({
        kanji,
        furigana,
        jpSentenceKanji: jpSentence[0],
        jpSentenceFuri: jpSentence[1],
        enSentence
    })
}

document.addEventListener("DOMContentLoaded", () => {
    const load = () => {
        const audioTags = Array.from(document.querySelectorAll("*[data-audio]"));
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
    }
    load()
    document.addEventListener("virtual-refresh", load)
})