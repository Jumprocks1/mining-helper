import { createElement } from "./util"

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