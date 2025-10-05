import { createElement } from "../utils/util"
import { parseSrt, Subtitles, formatTimestamp } from "../utils/srt"
import MpvWebSocket from "../utils/MpvWebSocket"
import { seedHeader } from "../components/MhHeader"

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
                    mutate: (e: any) => e.entry = entry
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
async function handleWebSocketData(command: string | Blob) {
    if (typeof command === "string") {
        const spl = command.indexOf(":")
        if (spl === -1) { console.error({ command, message: "Missing :" }); return }
        const commandName = command.substring(0, spl);
        const commandValue = command.substring(spl + 1);
        handleCommandAndData(commandName, commandValue)
    } else {
        const bytes = new Uint8Array(await command.arrayBuffer());
        const spl = bytes.indexOf(":".charCodeAt(0))
        if (spl === -1) return
        const commandName = new TextDecoder().decode(bytes.subarray(0, spl));
        handleCommandAndData(commandName, bytes.subarray(spl + 1))
    }
}
function handleCommandAndData(commandName: string, commandData: string | Uint8Array<ArrayBuffer>) {
    if (commandName === "time" || commandName === "t") {
        updateTime(parseFloat(commandData as string))
    } else if (commandName === "raw-sub-file") {
        const decoded = new TextDecoder().decode(commandData as Uint8Array)
        loadSubtitles(parseSrt(decoded), true)
    }
}

document.addEventListener("DOMContentLoaded", () => {
    seedHeader()
    let webSocket = new MpvWebSocket()
    webSocket.onMessage = (e) => handleWebSocketData(e.data)
    const connectionDot = document.getElementById("connection-status-dot")!
    webSocket.onConnecting = () => {
        connectionDot.title = "WebSocket connecting"
        connectionDot.classList.remove(...connectionDot.classList);
    }
    webSocket.onOpen = () => {
        connectionDot.title = "WebSocket connected"
        connectionDot.classList.add("connected")
        connectionDot.classList.remove("disconnected")
    }
    webSocket.onClose = () => {
        connectionDot.title = "WebSocket disconnected\nClick to retry"
        connectionDot.classList.remove("connected")
        connectionDot.classList.add("disconnected")
    }
    webSocket.Connect()

    document.addEventListener("keydown", ev => {
        if (ev.key === "s") {
            // TODO allow picking (instead of forcing id 6)
            webSocket.OpenAndSend("ipc:script-message read_subtitles 6");
        }
    })

    document.addEventListener("click", ev => {
        const clicked = ev.target as HTMLElement | null
        if (clicked) {
            if (clicked.classList.contains("timestamp")) {
                const entry = (clicked as any).entry
                if (!entry) return
                const time = entry.startTime
                webSocket.OpenAndSend(`ipc:seek ${time / 1000} absolute`)
                ev.preventDefault();
            } else if (clicked.matches("#connection-status-dot.disconnected")) {
                webSocket.Connect();
                ev.preventDefault();
            }
        }
    })

    const bodyContainer = document.getElementById("body-container")
    if (!bodyContainer) return

    bodyContainer.addEventListener("dragover", ev => {
        ev.preventDefault()
    })
    bodyContainer.addEventListener("drop", ev => {
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
})

document.addEventListener("keypress", ev => {
    console.log(ev)
    const sel = getSelection()
    if (sel) {
        const text = sel.toString()
        if (ev.key === "j") {
            chrome.tabs.create({ url: `https://jisho.org/search/${encodeURIComponent(text)}` });
        } else if (ev.key == "d") {
            chrome.tabs.create({ url: `https://jpdb.io/search?q=${encodeURIComponent(text)}&lang=english` });
        }
    }
})
