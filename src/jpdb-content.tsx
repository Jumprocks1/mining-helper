import { getAnkiWords } from "./anki/CardList"
import { disallowGlobalInput, handleKeypress, keyPressedWithText } from "./utils/GlobalHotkeys"
import { CardData, furiToReading } from "./utils/util"
import "./framework/createElement"
import { mutatePendingCard } from "./utils/MiningUtil"
import { getAudio, getAudioOptionsFromKanji, playAudio } from "./utils/Audio"

const style = `
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

const css = document.createElement("style")
css.innerHTML = style
target.prepend(css)

interface AudioEntry {
    Source: string
    File: string
    Reading: string
    ID: number
}

async function getAudioOptions(vocab?: HTMLElement | null) {
    if (!vocab) return
    const wordRuby = vocab.querySelector<HTMLElement>(".spelling ruby.v")
    if (!wordRuby) return
    const [kanji, furi] = kanjiAndFurigana(wordRuby)
    return getAudioOptionsFromKanji(kanji, furiToReading(furi))
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
                        await playAudio("jpdb", audioBytes.slice(0))
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

document.addEventListener("keypress", ev => {
    if (disallowGlobalInput(ev)) return
    if (handleKeypress(ev)) return
})