import { createElement } from "./util"
import subs from "./data/subs.json"
import { parseSrt, Subtitles, timestampString } from "./utils/srt"

function updateTime(time: string) {
    const timeElement = document.getElementById("current-time")
    if (timeElement)
        timeElement.textContent = time
}

setInterval(() => {
    const date = new Date()
    updateTime(date.getMinutes().toString().padStart(2, "0") + ":" + date.getSeconds().toString().padStart(2, "0"))
}, 1000)

function loadSubtitles(subtitiles: Subtitles, main: boolean) {
    const subtitleContainer = document.getElementById(main ? "main-subtitles" : "secondary-subtitles")
    if (!subtitleContainer) return
    const newChildren: Node[] = []
    for (const entry of subtitiles.entries) {
        newChildren.push(createElement("div", {
            className: "subtitle-entry",
            children: [
                createElement("span", {
                    className: "timestamp",
                    textContent: timestampString(entry.startTime),
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
    subtitleContainer.replaceChildren(...newChildren)
}

document.addEventListener("DOMContentLoaded", () => {
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

    loadSubtitles(subs as Subtitles, true)
    loadSubtitles(subs as Subtitles, false)
})

