import { oldCreateElement } from "../utils/util"
import { parseSrt, Subtitles, formatTimestamp } from "../utils/srt"
import MpvWebSocket from "../utils/MpvWebSocket"
import MhHeader from "../components/MhHeader"
import { seedPage } from "../components/util"
import SubtitleViewer from "./SubtitleViewer"
import { UnicodeCharacterType, unicodeType } from "../anki/CardList"

let currentTime = 0

function updateTime(timestamp: number) {
    currentTime = timestamp
    const timeElement = document.getElementById("current-time")
    if (timeElement)
        timeElement.textContent = formatTimestamp(timestamp)

    loadedSubtitles.main?.UpdateHighlighting(currentTime)
    loadedSubtitles.secondary.forEach(e => e.UpdateHighlighting(currentTime))
}
// @ts-expect-error
window.updateTime = updateTime

const loadedSubtitles: {
    main?: SubtitleViewer
    secondary: SubtitleViewer[]
} = { secondary: [] }

function loadSubtitles(subtitles: Subtitles, main: boolean) {
    const container = document.getElementById("subtitle-container")
    if (!container) return


    if (main) loadedSubtitles.main?.Node.remove()

    const viewer = new SubtitleViewer(subtitles, main)
    container.append(viewer.Node)
    viewer.UpdateHighlighting(currentTime)

    if (main) loadedSubtitles.main = viewer
    else loadedSubtitles.secondary.push(viewer)
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
    seedPage("mpv-page", [
        MhHeader(),
        <div id="outer-body-container">
            <div id="status-info">
                <span id="current-time">00:00</span>
                <span id="connection-status-dot"></span>
            </div>
            <div id="body-container">
                <div id="subtitle-container">
                </div>
            </div>
        </div>
    ])
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
        if (!loadedSubtitles.main)
            webSocket.SendIfOpen("ipc:script-message read_subtitles 6");
    }
    webSocket.onClose = () => {
        connectionDot.title = "WebSocket disconnected\nClick to retry"
        connectionDot.classList.remove("connected")
        connectionDot.classList.add("disconnected")
    }
    webSocket.Connect()

    document.addEventListener("keypress", ev => {
        const sel = getSelection()
        if (sel && !sel.isCollapsed) {
            const text = sel.toString()
            if (ev.key === "j") {
                chrome.tabs.create({ url: `https://jisho.org/search/${encodeURIComponent(text)}` });
            } else if (ev.key == "d") {
                const isSingleKanji = text.length === 1 && unicodeType(text) === UnicodeCharacterType.Kanji
                if (isSingleKanji)
                    chrome.tabs.create({ url: `https://jpdb.io/kanji/${encodeURIComponent(text)}` });
                else
                    chrome.tabs.create({ url: `https://jpdb.io/search?q=${encodeURIComponent(text)}&lang=english` });
            } else if (ev.key === "s") {
                chrome.tabs.create({ url: `https://sentencesearch.neocities.org/#${encodeURIComponent(text)}` });
            }
        } else {
            if (ev.key === "h") {
                loadedSubtitles.main?.HighlightAnkiWords()
            }
        }
    })

    document.addEventListener("click", ev => {
        const clicked = ev.target as HTMLElement | null
        if (clicked) {
            if (clicked.classList.contains("timestamp")) {
                const entry = (clicked as any).entry
                if (!entry) return
                const time = entry.startTime
                if (webSocket.Open) webSocket.SendIfOpen(`ipc:seek ${time / 1000} absolute`)
                else updateTime(time)
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
