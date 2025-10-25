import { getAnkiWords } from "./anki/CardList"
import { handleKeypress, keyPressedWithText } from "./utils/GlobalHotkeys"
import { CardData } from "./utils/util"
import "./utils/createElement"
import { mutatePendingCard } from "./utils/MiningUtil"

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

.vocabulary.has-anki-card .primary-spelling > .spelling > div,
    .entry.has-anki-card .vocabulary-spelling > a
{
    background: oklch(0.7012 0.1888 143.23 / 30%) !important;
}

.good-audio {
    cursor: pointer;
    position: relative;
}
.audio-menu {
    position: absolute;
    left: 0;
    top: 100%;
    display: flex;
    background: #111;
    border: 1px solid white;
    z-index: 1000;
    flex-direction: column;
}
.audio-menu-source {
    padding: 3px;
}
.audio-menu-source:hover {
    background: #FFFFFF20;
}
.audio-menu-source:not(:last-child) {
    border-bottom: 1px solid #FFFFFF80;
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

let audioContext
async function playAudio(arrayBuffer: ArrayBuffer) {
    audioContext ??= new AudioContext();
    const source = audioContext.createBufferSource();
    source.buffer = await audioContext.decodeAudioData(arrayBuffer);
    source.connect(audioContext.destination);
    source.start();
}

interface AudioEntry {
    Source: string
    File: string
    Reading: string
    ID: number
}

function select(css: string, node: HTMLElement | undefined | null) {
    const all = document.querySelectorAll(css)
    for (const e of all) e.classList.remove("selected")
    if (node) node.classList.add("selected")
}

async function getAudioOptions(vocab?: HTMLElement | null) {
    if (!vocab) return
    const wordRuby = vocab.querySelector<HTMLElement>(".spelling ruby.v")
    if (!wordRuby) return
    const [kanji,] = kanjiAndFurigana(wordRuby)
    return getAudioOptionsFromKanji(kanji)
}

// todo filter more based on reading too, since many kanji have multiple readings
async function getAudioOptionsFromKanji(kanji: string) {
    const audioOptions = await fetch("http://127.0.0.1:8080", { method: "POST", body: `lookup-audio:${kanji}` })
    return await audioOptions.json() as AudioEntry[]
}

async function getAudio(entry?: AudioEntry) {
    if (!entry) return
    const audioBytes = await fetch("http://127.0.0.1:8080", { method: "POST", body: `audio-bytes:${entry.ID}` })
    if (!audioBytes.ok) return
    return await audioBytes.arrayBuffer()
}

async function getFirstAudio(kanji: string) {
    const options = await getAudioOptionsFromKanji(kanji)
    if (options.length > 0) {
        const buffer = await getAudio(options[0])
        if (buffer) {
            return [options[0], buffer] as const
        }
    }
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
    const entries = document.querySelectorAll(".entry")
    for (const vocab of entries) {
        const wordRuby = vocab.querySelector<HTMLElement>(".vocabulary-spelling>a")
        if (wordRuby) {
            const [kanji,] = kanjiAndFurigana(wordRuby)
            if (allAnkiWords.includes(kanji))
                vocab.classList.add("has-anki-card")
        }
    }

    const wordBoxes = document.querySelectorAll(".vbox .subsection-headword>.menu");
    for (const menu of wordBoxes) {
        const goodAudioButton = <div className="good-audio">audio</div>
        goodAudioButton.onclick = async (ev) => {
            ev.preventDefault()
            let menu = goodAudioButton.querySelector<HTMLElement>(".audio-menu")
            if (menu) {
                menu.remove()
                return
            }
            const vocab = goodAudioButton.closest<HTMLElement>(".vocabulary")
            const audioOptions = await getAudioOptions(vocab)
            if (!audioOptions) return
            console.log(audioOptions)
            menu = <div className="audio-menu">
                {audioOptions.map(e => {
                    const o = <div className="audio-menu-source">{e.Source}</div>
                    // @ts-expect-error
                    o.audioEntry = e
                    return o
                })}
            </div>
            menu.onclick = async ev => {
                ev.stopPropagation();
                ev.preventDefault();
                const target = ev.target as HTMLElement | null
                if (target && target.classList.contains("audio-menu-source")) {
                    const entry: AudioEntry = (target as any).audioEntry
                    const audioBytes = await getAudio(entry)
                    if (audioBytes) {
                        // slice so we still have access to arrayBuffer, otherwise audio thread steals it
                        await playAudio(audioBytes.slice(0))
                        if (!vocab) return
                        const wordRuby = vocab.querySelector<HTMLElement>(".spelling ruby.v")
                        if (!wordRuby) return
                        const [kanji,] = kanjiAndFurigana(wordRuby)
                        await mutatePendingCard(kanji, false, card => {
                            card.audioBytes = audioBytes
                            card.audioLocalFile = `${kanji}_${entry.Source}.mp3`
                        })
                    }
                }
            }
            goodAudioButton.appendChild(menu)
        }
        menu.parentNode!.insertBefore(goodAudioButton, menu)
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
                kanjiAndFurigana(node.childNodes[0], o)
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


    await mutatePendingCard(kanji, false, async card => {
        card.furigana = furigana

        const meaningElement = vocab.querySelector<HTMLElement>(meaningCss + ".selected") ?? vocab.querySelector<HTMLElement>(meaningCss)
        if (meaningElement) {
            select(meaningCss, meaningElement)
            let description = meaningElement.childNodes[0].textContent?.replace(/^\d+\./, "").trim()
            if (description) card.meaning = description;
            card.meaningIndex = "jpdb_" + [...document.querySelectorAll(meaningCss)].indexOf(meaningElement);
        }

        let jpdbAudio = undefined

        if (!card.audioBytes) {
            const firstAudio = await getFirstAudio(kanji)
            if (firstAudio) {
                card.audioLocalFile = `${kanji}_${firstAudio[0].Source}.mp3`
                card.audioBytes = firstAudio[1]
            } else {
                const wordAudioAnchor = vocab.querySelector<HTMLElement>("*[data-audio].vocabulary-audio")
                if (wordAudioAnchor) {
                    jpdbAudio = wordAudioAnchor.dataset.audio!.split(",")[0]
                    const audioLocalFile = `${kanji}_${jpdbAudio.replace("/", "_")}.ogg`
                    card.audioLocalFile = audioLocalFile
                }
            }
        }


        let sentenceAudio = undefined

        if (sentenceElement) {
            const jpEl = sentenceElement.querySelector("div.jp");
            if (jpEl) {
                const jpSentence = kanjiAndFurigana(jpEl)
                card.jpSentenceKanji = jpSentence[0]
                card.jpSentenceFuri = jpSentence[1]
            }
            card.enSentence = sentenceElement.querySelector("div.en")?.textContent
            card.sentenceIndex = "jpdb_" + [...document.querySelectorAll(sentenceCss)].indexOf(sentenceElement)

            const sentenceAudioAnchor = sentenceElement.parentElement?.querySelector<HTMLElement>("*[data-audio].example-audio")
            if (sentenceAudioAnchor) {
                sentenceAudio = sentenceAudioAnchor.dataset.audio!.split(",")[0]
                card.sentenceAudioLocalFile = `${kanji}_ex_${sentenceAudio.replace("/", "_")}.ogg`
            }
        }

        if (sentenceAudio && jpdbAudio) {
            const [audioBytes, sentenceAudioBytes] = await requestAudio([jpdbAudio, sentenceAudio])
            card.audioBytes = audioBytes
            card.sentenceAudioBytes = sentenceAudioBytes
        } else if (jpdbAudio) {
            const [audioBytes,] = await requestAudio([jpdbAudio,])
            card.audioBytes = audioBytes
        }
    })
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
    const targetElement = ev.target as HTMLElement | null
    if (targetElement && targetElement.nodeName === "INPUT") return
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