import { parseSrt, Subtitles, formatTimestamp, SubtitleEntryWithCharacterOffset } from "../utils/srt"
import MpvWebSocket from "../utils/MpvWebSocket"
import MhHeader from "../components/MhHeader"
import { seedPage } from "../components/util"
import SubtitleViewer from "./SubtitleViewer"
import { disallowGlobalInput, handleKeypress } from "../utils/GlobalHotkeys"
import MiningModal from "../components/MiningModal"
import { Modal } from "../components/Modal"
import IconButton from "../components/basic/IconButton"
import SettingsModal, { getSetting, onSettingChange, setSetting } from "../views/SettingsModal"
import { applyReplacementsTo, getReplacements } from "../views/RegexReplacements"
import { JpdbParseSubtitles } from "../jpdb/JpdbParseText"

let currentTime = 0

function updateTime(timestamp: number) {
    currentTime = timestamp
    const timeElement = document.getElementById("current-time")
    if (timeElement)
        timeElement.textContent = formatTimestamp(currentTime)

    loadedSubtitles.main?.UpdateHighlighting(currentTime)
    loadedSubtitles.secondary.forEach(e => e.UpdateHighlighting(currentTime))
}
// @ts-expect-error
window.updateTime = updateTime

const loadedSubtitles: {
    main?: SubtitleViewer
    secondary: SubtitleViewer[]
} = { secondary: [] }

onSettingChange("offset", async offset => {
    const subs = loadedSubtitles.main?.subtitles
    if (subs) {
        if (subs.offset ?? 0 !== offset) {
            subs.offset = offset
            await loadSubtitles(subs, true)
        }
    }
})
onSettingChange("regexReplacements", async offset => {
    const subs = loadedSubtitles.main?.subtitles
    if (subs) await loadSubtitles(subs, true)
})

async function loadSubtitles(subtitles: Subtitles, main: boolean) {

    const offset = subtitles.offset ?? 0
    setSetting("offset", offset)
    const replacements = await getReplacements()
    const res: SubtitleEntryWithCharacterOffset[] = []

    let characterOffset = 0
    for (const entry of subtitles.originalEntries) {
        const text = applyReplacementsTo(replacements, entry.text, false)
        if (!text) continue
        const p = {
            ...entry,
            startTime: entry.startTime + offset,
            endTime: entry.endTime + offset,
            text,
            characterOffset
        } satisfies SubtitleEntryWithCharacterOffset
        res.push(p)
        characterOffset += p.text.length + 1 // +1 for \n when joining lines for jpdb
    }
    subtitles.processedEntries = res

    const container = document.getElementById("subtitle-container")
    if (!container) return

    if (subtitles.hash) {
        chrome.storage.local.set({ recentOffsets: { [subtitles.hash]: offset } })
    }


    if (main) loadedSubtitles.main?.Node.remove()

    const viewer = new SubtitleViewer(subtitles, main)
    container.append(viewer.Node)
    viewer.UpdateHighlighting(currentTime)

    if (main) {
        loadedSubtitles.main = viewer
        viewer.JumpTo(viewer.LatestEntry(currentTime))
    }
    else loadedSubtitles.secondary.push(viewer)
}
async function handleWebSocketData(webSocket: MpvWebSocket, command: string | Blob) {
    if (typeof command === "string") {
        const spl = command.indexOf(":")
        if (spl === -1) { console.error({ command, message: "Missing :" }); return }
        const commandName = command.substring(0, spl);
        const commandValue = command.substring(spl + 1);
        await handleCommandAndData(webSocket, commandName, commandValue)
    } else {
        const bytes = new Uint8Array(await command.arrayBuffer());
        const spl = bytes.indexOf(":".charCodeAt(0))
        if (spl === -1) return
        const commandName = new TextDecoder().decode(bytes.subarray(0, spl));
        await handleCommandAndData(webSocket, commandName, bytes.subarray(spl + 1))
    }
}
async function handleCommandAndData(webSocket: MpvWebSocket, commandName: string, commandData: string | Uint8Array<ArrayBuffer>) {
    if (commandName === "time" || commandName === "t") {
        updateTime(parseFloat(commandData as string))
    } else if (commandName === "raw-sub-file") {
        const decoded = new TextDecoder().decode(commandData as Uint8Array)
        await loadSubtitles(await parseSrt(decoded), true)
    } else if (commandName === "response") {
        await webSocket.HandleResponse(commandData)
    }
}

let mpvWebSocket: MpvWebSocket | undefined
export function seekToSubtitle(entry: SubtitleEntry) {
    if (!mpvWebSocket) return
    mpvWebSocket.SendIfOpen(`ipc:seek ${entry.startTime / 1000} absolute`)
}
export function getCurrentMpvTime() { return currentTime }

export function seekToNextEntry(entries: SubtitleEntry[], backwards: boolean) {
    // TODO add epsilon
    // const epsilon = 200 // ms
    if (!mpvWebSocket) return
    if (backwards) {
        for (let i = 1; i < entries.length; i++) {
            if (entries[i].endTime > currentTime) {
                seekToSubtitle(entries[i - 1])
                return
            }
        }
        seekToSubtitle(entries[0])
    } else {
        for (let i = 0; i < entries.length; i++) {
            if (entries[i].startTime > currentTime) {
                seekToSubtitle(entries[i])
                return
            }
        }
        seekToSubtitle(entries[entries.length - 1])
    }
}

document.addEventListener("DOMContentLoaded", () => {
    seedPage("subs-page", [
        MhHeader(),
        <div id="outer-body-container">
            <div id="status-info">
                <IconButton icon="settings" onClick={() => SettingsModal()} />
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
    mpvWebSocket = webSocket
    webSocket.onMessage = (e) => handleWebSocketData(webSocket, e.data)
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
            webSocket.SendIfOpen("ipc:script-message read_subtitles ja");
    }
    webSocket.onClose = () => {
        connectionDot.title = "WebSocket disconnected\nClick to retry"
        connectionDot.classList.remove("connected")
        connectionDot.classList.add("disconnected")
    }
    webSocket.Connect()

    let miningModal: Modal | undefined;

    document.addEventListener("keypress", ev => {
        if (disallowGlobalInput(ev)) return
        if (handleKeypress(ev)) return
        if (ev.key === "h") {
            loadedSubtitles.main?.HighlightAnkiWords()
        } else if (ev.key === "v") {
            webSocket.SendIfOpen("ipc:cycle sub-visibility");
        } else if (ev.key === " ") {
            webSocket.SendIfOpen("ipc:cycle pause");
            ev.preventDefault()
        } else if (ev.key === "m") {
            if (miningModal) {
                miningModal.Close()
            } else {
                const selected = getSelection()
                if (selected) {
                    const anchor = selected.anchorNode?.parentElement as HTMLElement
                    const entry = anchor?.closest<HTMLElement>(".subtitle-entry")?.subtitleEntry
                    if (entry) {
                        miningModal = MiningModal({
                            word: selected.toString(), entry, mpv: webSocket,
                            entries: loadedSubtitles.main!.subtitles.processedEntries,
                            onClose: () => miningModal = undefined
                        })
                        miningModal.Open()
                    }
                }
            }
        }
    })

    document.addEventListener("keydown", ev => {
        if (disallowGlobalInput(ev)) return
        const subs = loadedSubtitles.main
        if (subs) {
            if (ev.key === "ArrowUp") {
                seekToNextEntry(subs.subtitles.processedEntries, true)
                ev.preventDefault()
            } else if (ev.key === "ArrowDown" || ev.key === "ArrowRight") {
                seekToNextEntry(subs.subtitles.processedEntries, false)
                ev.preventDefault()
            } else if (ev.key === "ArrowLeft") {
                const entries = subs.subtitles.processedEntries
                for (let i = 0; i < entries.length - 1; i++) {
                    if (entries[i].startTime < currentTime && entries[i + 1].startTime > currentTime) {
                        webSocket.SendIfOpen(`ipc:seek ${entries[i].startTime / 1000} absolute`)
                        ev.preventDefault();
                        break
                    }
                }
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
                if (ev.ctrlKey) {
                    const subs = loadedSubtitles.main?.subtitles
                    setSetting("offset", (subs?.offset ?? 0) + currentTime - entry.startTime)
                } else {
                    if (webSocket.Open) webSocket.SendIfOpen(`ipc:seek ${time / 1000} absolute`)
                    else updateTime(time)
                }
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
                reader.onload = async e => {
                    const target = e.target
                    if (target && typeof target.result === "string") {
                        await loadSubtitles(await parseSrt(target.result), true)
                    }
                }
                reader.readAsText(file)
            }
        }
    })
})
