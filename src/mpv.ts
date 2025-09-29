import { createElement } from "./util"
import { parseSrt } from "./utils/srt"

export { }

function updateTime(time: string) {
    const timeElement = document.getElementById("current-time")
    if (timeElement)
        timeElement.textContent = time
}

setInterval(() => {
    const date = new Date()
    updateTime(date.getMinutes().toString().padStart(2, "0") + ":" + date.getSeconds().toString().padStart(2, "0"))
}, 1000)

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
                        console.log(parseSrt(target.result))
                    }
                }
                reader.readAsText(file)
            }
        }
    })

    for (let i = 0; i < 250; i++) {
        subtitleContainer.append(createElement("div", {
            className: "subtitle", children: [
                createElement("span", {
                    className: "time",
                    textContent: "00:00.00"
                }),
                "aaaa " + i,
            ]
        }))
    }
})