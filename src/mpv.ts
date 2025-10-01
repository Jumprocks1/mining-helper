import { createElement } from "./util"
import subs from "./data/subs.json"
import { parseSrt, Subtitles, formatTimestamp } from "./utils/srt"
import MpvWebSocket from "./utils/MpvWebSocket"


let currentTime = 0

function updateTime(timestamp: number) {
    currentTime = timestamp
    const timeElement = document.getElementById("current-time")
    if (timeElement)
        timeElement.textContent = formatTimestamp(timestamp)

    updateHighlighting(loadedSubtitles.main)
    updateHighlighting(loadedSubtitles.secondary)
}

function updateHighlighting(subtitles?: Subtitles) {
    const scroll = document.getElementById("body-container")
    if (!subtitles || !scroll) return
    const main = loadedSubtitles.main === subtitles
    const pointer = scroll.querySelector<HTMLElement>(main ? "#main-subtitles .pointer" : "#secondary-subtitles .pointer")!
    for (let i = 0; i < subtitles.entries.length; i++) {
        const entry = subtitles.entries[i]
        const node = entry.node
        if (node) {
            if (entry.startTime <= currentTime && entry.endTime >= currentTime) {
                pointer.style.top = node.offsetTop + node.offsetHeight / 2 + "px"
                break
            }
            if (entry.startTime > currentTime) {
                const prevEntry = i > 0 ? subtitles.entries[i - 1] : undefined
                const prevTime = prevEntry?.endTime ?? 0
                const prevPos = (prevEntry && prevEntry.node) ?
                    prevEntry.node.offsetTop + prevEntry.node.clientHeight / 2 : 0
                const a = (currentTime - prevTime) / (entry.startTime - prevTime)
                pointer.style.top = prevPos + (node.offsetTop + node.offsetHeight / 2 - prevPos) * a + "px"
                break
            }
        }
    }
    for (const entry of subtitles.entries) {
        const node = entry.node
        if (node) {
            if (entry.startTime <= currentTime && entry.endTime >= currentTime) {
                // only scroll if we add a new highlight
                if (!node.classList.contains("highlight")) {
                    node.classList.add("highlight")
                    if (main) {
                        const center = node.offsetTop + node.offsetHeight / 2;
                        const scrollHeight = scroll.clientHeight
                        if (center < scroll.scrollTop + scroll.clientHeight / 6
                            || center > scroll.scrollTop + scroll.clientHeight * (1 - 1 / 6)) {
                            scroll.scrollTo({ top: center - scrollHeight / 6 });
                        }
                    }
                }
            } else {
                node.classList.remove("highlight")
            }
        }
    }
}

const loadedSubtitles: {
    main?: Subtitles
    secondary?: Subtitles
} = {}

function loadSubtitles(subtitiles: Subtitles, main: boolean) {
    const subtitleContainer = document.getElementById(main ? "main-subtitles" : "secondary-subtitles")
    if (!subtitleContainer) return
    const inner = subtitleContainer.querySelector<HTMLElement>(".inner")
    if (!inner) return
    const newChildren: Node[] = []
    for (const entry of subtitiles.entries) {
        newChildren.push(entry.node = createElement("div", {
            className: "subtitle-entry",
            children: [
                createElement("span", {
                    className: "timestamp",
                    textContent: formatTimestamp(entry.startTime),
                }),
                createElement("div", {
                    className: "subtitles",
                    children: [
                        createElement("span", {
                            className: "main-subtitle",
                            textContent: entry.text,
                            data: {
                                tooltip: entry.translation
                            }
                        }),
                    ]
                })
            ]
        }))
    }
    inner.replaceChildren(...newChildren)
    if (main) loadedSubtitles.main = subtitiles
    else loadedSubtitles.secondary = subtitiles
}

document.addEventListener("DOMContentLoaded", () => {
    const webSocket = new MpvWebSocket()
    webSocket.onMessage = (e) => {
        updateTime(parseFloat(e.data))
    }
    const subtitleContainer = document.getElementById("subtitle-container")
    if (!subtitleContainer) return

    subtitleContainer.addEventListener("dragover", ev => {
        ev.preventDefault()
    })
    subtitleContainer.addEventListener("drop", ev => {
        ev.preventDefault()
        const files = ev.dataTransfer?.files
        if (!files) return
        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            if (file.name.endsWith(".srt")) {
                const reader = new FileReader()
                reader.onload = e => {
                    const target = e.target
                    if (target && typeof target.result === "string") {
                        const subs = parseSrt(target.result)
                        console.log(subs)
                        loadSubtitles(subs, true)
                    }
                }
                reader.readAsText(file)
            }
        }
    })

    loadSubtitles(JSON.parse(JSON.stringify(subs)) as Subtitles, true)
    loadSubtitles(subs as Subtitles, false)
})

