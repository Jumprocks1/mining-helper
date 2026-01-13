import { parseSrt, Subtitles, formatTimestamp, SubtitleEntryWithCharacterOffset, SubtitleEntry, OffsetCache } from "../../utils/srt"
import MpvWebSocket from "../../utils/MpvWebSocket"
import MhHeader from "../../components/MhHeader"
import SubtitleViewer from "./SubtitleViewer"
import { disallowGlobalInput, handleKeyDown } from "../../utils/GlobalHotkeys"
import MiningModal from "../../components/MiningModal"
import { Modal } from "../../components/Modal"
import IconButton from "../../components/basic/IconButton"
import SettingsModal, { getSetting, onSettingChange, setSetting } from "../../views/SettingsModal"
import { applyReplacementsTo, getReplacements } from "../../views/RegexReplacements"
import { JpdbParseSubtitles } from "../../jpdb/JpdbParseText"
import RecommendedMiningModal from "./RecommendedMiningModal"
import { getCharacterIndex } from "../../utils/CharacterHighlighter"
import { EmptyLayout, loadPage, Page } from "../../framework/Page"
import { Children } from "../../framework/createElement"

document.addEventListener("DOMContentLoaded", () => loadPage(SubtitlesPage))

export default class SubtitlesPage extends Page {
    Id = "subs-page"
    Node: Children
    override Layout = EmptyLayout // we use an extra body container, so can't use normal layout
    override Title = "Mining Helper - Subtitles"

    currentFilename?: string
    currentTime = 0
    loadedSubtitles: SubtitleViewer | undefined
    mpvWebSocket?: MpvWebSocket
    subtitleContainer = <div id="subtitle-container" />
    bodyContainer = <div id="body-container">
        {this.subtitleContainer}
    </div>
    timeElement = <span id="current-time">00:00</span>

    constructor() {
        super()

        onSettingChange("offset", async offset => {
            const subs = this.loadedSubtitles?.subtitles
            if (subs) {
                if (subs.offset ?? 0 !== offset) {
                    subs.offset = offset
                    this.reloadSubs()
                }
            }
        })
        onSettingChange("regexReplacements", this.reloadSubs)
        onSettingChange("skipChapterRegex", this.reloadSubs)


        const header = MhHeader()
        const connectionDot = <span id="connection-status-dot" />
        this.Node = <>
            {header}
            <div id="outer-body-container">
                <div id="status-info">
                    <IconButton icon="settings" onClick={() => SettingsModal()} />
                    {this.timeElement}
                    {connectionDot}
                </div>
                {this.bodyContainer}
            </div>
        </>
        let webSocket = new MpvWebSocket()
        this.mpvWebSocket = webSocket
        webSocket.onMessage = (e) => this.handleWebSocketData(webSocket, e.data)
        webSocket.onConnecting = () => {
            connectionDot.title = "WebSocket connecting"
            connectionDot.classList.remove(...connectionDot.classList);
        }
        webSocket.onOpen = async () => {
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

        let miningModal: Modal | undefined;

        document.addEventListener("keydown", ev => {
            if (disallowGlobalInput(ev)) return
            if (handleKeyDown(ev)) return
            const key = ev.key.toLowerCase()
            if (key === "h") {
                this.loadedSubtitles?.HighlightAnkiWords()
            } else if (key === "i") { // i for info?
                this.loadedSubtitles?.ToggleShift()
            } else if (key === "v") {
                webSocket.SendIfOpen("ipc:cycle sub-visibility");
            } else if (key === " ") {
                webSocket.SendIfOpen("ipc:cycle pause");
                ev.preventDefault()
            } else if (key === "m") {
                if (miningModal) {
                    miningModal.Close()
                } else {
                    // TODO if selection is collapsed, we should prioritze the hover element in the SubtitleViewer
                    // the hover token is easily gettable, but we'd have to rework most of the code below here
                    const selected = getSelection()
                    if (selected) {
                        const anchor = selected.anchorNode?.parentElement as HTMLElement
                        const htmlSubtitles = anchor.closest<HTMLElement>(".subtitles")
                        const htmlEntry = htmlSubtitles?.closest<HTMLElement>(".subtitle-entry")
                        const entry = htmlEntry?.subtitleEntry
                        if (htmlSubtitles && entry) {
                            let startIndex: number | undefined
                            let endIndex: number | undefined
                            // can only get these indices if the start/end for selection is in same entry
                            if (selected.focusNode && selected.focusNode.parentElement?.closest<HTMLElement>(".subtitles") === htmlSubtitles) {
                                startIndex = getCharacterIndex(htmlSubtitles, selected.anchorNode!, selected.anchorOffset)
                                endIndex = getCharacterIndex(htmlSubtitles, selected.focusNode!, selected.focusOffset)
                                if (startIndex > endIndex) {
                                    const temp = startIndex
                                    startIndex = endIndex
                                    endIndex = temp
                                }
                            }
                            miningModal = MiningModal({
                                word: selected.toString(), entry, mpv: webSocket,
                                subtitles: this.loadedSubtitles!.subtitles,
                                startIndex,
                                endIndex,
                                onClose: () => miningModal = undefined,
                                subtitlesPage: this
                            })
                            miningModal.Open()
                            webSocket.SendIfOpen(`ipc:seek ${entry.startTime / 1000} absolute`)
                            // Could use this to query, but really not needed
                            // webSocket.RequestIfOpen(`ipc-request:["get_property", "sub-visibility"]`)
                            webSocket.SendIfOpen(`ipc:set sub-visibility yes`)
                        }
                    }
                }
            } else if (key === "t") {
                if (this.loadedSubtitles) JpdbParseSubtitles(this.loadedSubtitles.subtitles)
            } else if (key === "y") {
                const subs = this.loadedSubtitles?.subtitles
                if (subs) {
                    (async () => {
                        const modal = await RecommendedMiningModal(subs, () => {
                            const main = this.loadedSubtitles?.Node
                            if (!main) return
                            const mainRect = main.getBoundingClientRect()
                            const headerRect = header.getBoundingClientRect()
                            const full = document.body.getBoundingClientRect()
                            const rect = new DOMRect(mainRect.right, headerRect.bottom, full.width - mainRect.right, full.height - headerRect.bottom)
                            return rect
                        }, this)
                        modal?.Minimize()
                    })()
                }
            }
        })

        document.addEventListener("keydown", ev => {
            if (disallowGlobalInput(ev)) return
            const subs = this.loadedSubtitles
            if (subs) {
                if (ev.key === "ArrowUp") {
                    this.seekToNextEntry(subs.subtitles.processedEntries, true)
                    ev.preventDefault()
                } else if (ev.key === "ArrowDown" || ev.key === "ArrowRight") {
                    this.seekToNextEntry(subs.subtitles.processedEntries, false)
                    ev.preventDefault()
                } else if (ev.key === "ArrowLeft") {
                    const entries = subs.subtitles.processedEntries
                    for (let i = 0; i < entries.length - 1; i++) {
                        if (entries[i].startTime < this.currentTime && entries[i + 1].startTime > this.currentTime) {
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
                        const subs = this.loadedSubtitles?.subtitles
                        setSetting("offset", (subs?.offset ?? 0) + this.currentTime - entry.startTime)
                    } else {
                        if (webSocket.Open) webSocket.SendIfOpen(`ipc:seek ${time / 1000} absolute`)
                        else this.updateTime(time)
                    }
                    ev.preventDefault();
                } else if (clicked.matches("#connection-status-dot.disconnected")) {
                    webSocket.Connect();
                    ev.preventDefault();
                }
            }
        })

        this.bodyContainer.addEventListener("dragover", ev => {
            ev.preventDefault()
        })
        this.bodyContainer.addEventListener("drop", ev => {
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
                            await this.loadSubtitles(await parseSrt(target.result))
                        }
                    }
                    reader.readAsText(file)
                }
            }
        })
    }

    updateTime(timestamp: number) {
        this.currentTime = timestamp
        this.timeElement.textContent = formatTimestamp(this.currentTime)
        this.loadedSubtitles?.UpdateHighlighting(this.currentTime)
    }

    async reloadSubs() {
        const subs = this.loadedSubtitles?.subtitles
        if (subs) {
            subs.jpdbParse = undefined // these get reloaded from cache if possible
            await this.loadSubtitles(subs)
        }
    }

    async loadSubtitles(subtitles: Subtitles) {
        const skip: [start: number, end?: number][] = []
        if (this.mpvWebSocket?.Open) {
            const skipChapterRegex = await getSetting("skipChapterRegex")
            if (skipChapterRegex) {
                const regex = new RegExp(skipChapterRegex)
                // bit inefficient but probably good
                const resp = await this.mpvWebSocket.RequestIfOpen(`ipc-request:["get_property", "chapter-list"]`)
                if (typeof resp === "string") {
                    const parsed = JSON.parse(resp) as { title: string, time: number }[]
                    for (let i = 0; i < parsed.length; i++) {
                        const chapter = parsed[i]
                        if (regex.test(chapter.title))
                            skip.push([chapter.time * 1000, i === parsed.length - 1 ? undefined : parsed[i + 1].time * 1000])
                    }
                }
            }
        }

        const offset = subtitles.offset ?? 0
        setSetting("offset", offset)
        const replacements = await getReplacements()
        const res: SubtitleEntryWithCharacterOffset[] = []

        let previous: SubtitleEntryWithCharacterOffset | undefined

        let characterOffset = 0
        for (const entry of subtitles.originalEntries) {
            const text = applyReplacementsTo(replacements, entry.text)
            if (!text) continue
            if (skip.length > 0) {
                let shouldSkip = false
                for (const e of skip) {
                    if (entry.startTime >= e[0] && (e[1] === undefined || entry.startTime < e[1])) {
                        shouldSkip = true
                        break
                    }
                }
                if (shouldSkip) continue
            }
            const p = {
                ...entry,
                startTime: entry.startTime + offset,
                endTime: entry.endTime + offset,
                text,
                characterOffset
            } satisfies SubtitleEntryWithCharacterOffset
            if (previous && previous.text === p.text) {
                previous.startTime = Math.min(previous.startTime, p.startTime)
                previous.endTime = Math.max(previous.endTime, p.endTime)
                continue
            }
            previous = p
            res.push(p)
            characterOffset += p.text.length + 1 // +1 for \n when joining lines for jpdb
        }
        subtitles.processedEntries = res

        if (subtitles.hash !== undefined) {
            OffsetCache.Store(subtitles.hash, offset)
        }


        this.loadedSubtitles?.Node.remove()

        const viewer = new SubtitleViewer(subtitles)
        this.subtitleContainer.append(viewer.Node)
        viewer.UpdateHighlighting(this.currentTime)

        this.loadedSubtitles = viewer
        viewer.JumpTo(viewer.LatestEntry(this.currentTime))
        JpdbParseSubtitles(this.loadedSubtitles.subtitles, true)
    }
    async handleWebSocketData(webSocket: MpvWebSocket, command: string | Blob) {
        if (typeof command === "string") {
            const spl = command.indexOf(":")
            if (spl === -1) { console.error({ command, message: "Missing :" }); return }
            const commandName = command.substring(0, spl);
            const commandValue = command.substring(spl + 1);
            await this.handleCommandAndData(webSocket, commandName, commandValue)
        } else {
            const bytes = new Uint8Array(await command.arrayBuffer());
            const spl = bytes.indexOf(":".charCodeAt(0))
            if (spl === -1) return
            const commandName = new TextDecoder().decode(bytes.subarray(0, spl));
            await this.handleCommandAndData(webSocket, commandName, bytes.subarray(spl + 1))
        }
    }
    async requestAndLoadSubs(webSocket: MpvWebSocket) {
        const subs = await webSocket.RequestIfOpen("jp-subs")
        if (typeof subs === "string") throw new Error()
        const decoded = new TextDecoder().decode(subs)
        await this.loadSubtitles(await parseSrt(decoded))
    }
    async handleCommandAndData(webSocket: MpvWebSocket, commandName: string, commandData: string | Uint8Array<ArrayBuffer>) {
        if (commandName === "time" || commandName === "t") {
            this.updateTime(parseFloat(commandData as string))
        } else if (commandName === "response") {
            await webSocket.HandleResponse(commandData)
        } else if (commandName === "current-file") {
            if (typeof commandData === "string") {
                if (commandData !== this.currentFilename) {
                    this.currentFilename = commandData
                    if (commandData) await this.requestAndLoadSubs(webSocket)
                }
            }
        }
    }
    seekToSubtitle(entry: SubtitleEntry) {
        if (this.mpvWebSocket?.Open)
            this.mpvWebSocket.SendIfOpen(`ipc:seek ${entry.startTime / 1000} absolute`)
        else this.updateTime(entry.startTime)
    }

    getNextEntryIndex(entries: SubtitleEntry[], backwards: boolean) {
        if (backwards) {
            for (let i = 1; i < entries.length; i++) {
                if (entries[i].endTime > this.currentTime) {
                    return i - 1
                }
            }
            return entries.length - 1
        } else {
            for (let i = 0; i < entries.length; i++) {
                if (entries[i].startTime > this.currentTime) {
                    return i
                }
            }
            return entries.length - 1
        }
    }
    seekToNextEntry(entries: SubtitleEntry[], backwards: boolean) {
        // TODO add epsilon
        // const epsilon = 200 // ms
        if (!this.mpvWebSocket) return
        const index = this.getNextEntryIndex(entries, backwards)
        this.seekToSubtitle(entries[index])
        return index
    }
}
