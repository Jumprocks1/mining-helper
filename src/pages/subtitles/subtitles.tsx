import { parseSrt, Subtitles, formatTimestamp, SubtitleEntryWithCharacterOffset, SubtitleEntry, OffsetCache } from "../../utils/srt"
import MpvWebSocket from "../../utils/MpvWebSocket"
import MhHeader from "../../components/MhHeader"
import SubtitleViewer from "./SubtitleViewer"
import { disallowGlobalInput, handleKeyDown } from "../../utils/GlobalHotkeys"
import MiningModal from "../../components/MiningModal"
import { Modal } from "../../components/Modal"
import IconButton from "../../components/basic/IconButton"
import SettingsModal, { getSetting, onSettingChange, removeOnSettingChange, setSetting } from "../../views/SettingsModal"
import { applyReplacementsTo, getReplacements } from "../../views/RegexReplacements"
import { JpdbParseSubtitles } from "../../jpdb/JpdbParseText"
import RecommendedMiningModal from "./RecommendedMiningModal"
import { getCharacterIndex } from "../../utils/CharacterHighlighter"
import { EmptyLayout, PageComponent } from "../../framework/PageComponent"
import { Children } from "../../framework/createElement"

export default class SubtitlesPage extends PageComponent {
    Id = "subs-page"
    Node: Children
    override Layout = EmptyLayout // we use an extra body container, so can't use normal layout
    override Title = "Mining Helper - Subtitles"

    CurrentFilename?: string
    CurrentTime = 0
    LoadedSubtitles: SubtitleViewer | undefined
    readonly MpvWebSocket: MpvWebSocket = new MpvWebSocket()
    SubtitleContainer = <div id="subtitle-container" />
    BodyContainer = <div id="body-container">
        {this.SubtitleContainer}
    </div>
    TimeElement = <span id="current-time">00:00</span>
    MiningModal?: Modal

    override Dispose() {
        removeOnSettingChange("offset", this.OffsetChanged)
        removeOnSettingChange("regexReplacements", this.ReloadSubs)
        removeOnSettingChange("skipChapterRegex", this.ReloadSubs)
        document.removeEventListener("keydown", this.DocumentKeydown)
        this.MpvWebSocket.Connection?.close()
    }

    OffsetChanged(offset: number) {
        const subs = this.LoadedSubtitles?.subtitles
        if (subs) {
            if (subs.offset ?? 0 !== offset) {
                subs.offset = offset
                this.ReloadSubs()
            }
        }
    }

    DocumentKeydown = (ev: KeyboardEvent) => {
        this.LoadedSubtitles?.DocumentKeydown(ev)
        if (disallowGlobalInput(ev)) return
        if (handleKeyDown(ev)) return
        const key = ev.key.toLowerCase()

        const subs = this.LoadedSubtitles
        if (subs) {
            if (ev.key === "ArrowUp") {
                this.SeekToNextEntry(subs.subtitles.processedEntries, true)
                ev.preventDefault()
            } else if (ev.key === "ArrowDown" || ev.key === "ArrowRight") {
                this.SeekToNextEntry(subs.subtitles.processedEntries, false)
                ev.preventDefault()
            } else if (ev.key === "ArrowLeft") {
                const entries = subs.subtitles.processedEntries
                for (let i = 0; i < entries.length - 1; i++) {
                    if (entries[i].startTime < this.CurrentTime && entries[i + 1].startTime > this.CurrentTime) {
                        this.MpvWebSocket.SendIfOpen(`ipc:seek ${entries[i].startTime / 1000} absolute`)
                        ev.preventDefault();
                        break
                    }
                }
            }
        }

        if (key === "h") {
            this.LoadedSubtitles?.HighlightAnkiWords()
        } else if (key === "i") { // i for info?
            this.LoadedSubtitles?.ToggleShift()
        } else if (key === "v") {
            this.MpvWebSocket.SendIfOpen("ipc:cycle sub-visibility");
        } else if (key === " ") {
            this.MpvWebSocket.SendIfOpen("ipc:cycle pause");
            ev.preventDefault()
        } else if (key === "m") {
            if (this.MiningModal) {
                this.MiningModal.Close()
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
                        this.MiningModal = MiningModal({
                            word: selected.toString(), entry, mpv: this.MpvWebSocket,
                            subtitles: this.LoadedSubtitles!.subtitles,
                            startIndex,
                            endIndex,
                            onClose: () => this.MiningModal = undefined,
                            subtitlesPage: this
                        })
                        this.MiningModal.Open()
                        this.MpvWebSocket.SendIfOpen(`ipc:seek ${entry.startTime / 1000} absolute`)
                        // Could use this to query, but really not needed
                        // webSocket.RequestIfOpen(`ipc-request:["get_property", "sub-visibility"]`)
                        this.MpvWebSocket.SendIfOpen(`ipc:set sub-visibility yes`)
                    }
                }
            }
        } else if (key === "t") {
            if (this.LoadedSubtitles) JpdbParseSubtitles(this.LoadedSubtitles.subtitles)
        } else if (key === "y") {
            const subs = this.LoadedSubtitles?.subtitles
            if (subs) {
                (async () => {
                    const modal = await RecommendedMiningModal(subs, () => {
                        const main = this.LoadedSubtitles?.Node
                        if (!main) return
                        const mainRect = main.getBoundingClientRect()
                        const headerRect = this.Header.getBoundingClientRect()
                        const full = document.body.getBoundingClientRect()
                        const rect = new DOMRect(mainRect.right, headerRect.bottom, full.width - mainRect.right, full.height - headerRect.bottom)
                        return rect
                    }, this)
                    modal?.Minimize()
                })()
            }
        }
    }

    Header = MhHeader()

    constructor() {
        super()

        onSettingChange("offset", this.OffsetChanged)
        onSettingChange("regexReplacements", this.ReloadSubs)
        onSettingChange("skipChapterRegex", this.ReloadSubs)


        const connectionDot = <span id="connection-status-dot" onclick={ev => {
            this.MpvWebSocket.Connect();
            ev.preventDefault();
        }} />
        this.Node = <>
            {this.Header}
            <div id="outer-body-container">
                <div id="status-info">
                    <IconButton icon="settings" onClick={() => SettingsModal()} />
                    {this.TimeElement}
                    {connectionDot}
                </div>
                {this.BodyContainer}
            </div>
        </>
        this.MpvWebSocket.onMessage = (e) => this.HandleWebSocketData(this.MpvWebSocket, e.data)
        this.MpvWebSocket.onConnecting = () => {
            connectionDot.title = "WebSocket connecting"
            connectionDot.classList.remove(...connectionDot.classList);
        }
        this.MpvWebSocket.onOpen = async () => {
            connectionDot.title = "WebSocket connected"
            connectionDot.classList.add("connected")
            connectionDot.classList.remove("disconnected")
        }
        this.MpvWebSocket.onClose = () => {
            connectionDot.title = "WebSocket disconnected\nClick to retry"
            connectionDot.classList.remove("connected")
            connectionDot.classList.add("disconnected")
        }
        this.MpvWebSocket.Connect()

        document.addEventListener("keydown", this.DocumentKeydown)

        this.BodyContainer.addEventListener("dragover", ev => {
            ev.preventDefault()
        })
        this.BodyContainer.addEventListener("drop", ev => {
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
                            await this.LoadSubtitles(await parseSrt(target.result))
                        }
                    }
                    reader.readAsText(file)
                }
            }
        })
    }

    UpdateTime(timestamp: number) {
        this.CurrentTime = timestamp
        this.TimeElement.textContent = formatTimestamp(this.CurrentTime)
        this.LoadedSubtitles?.UpdateHighlighting(this.CurrentTime)
    }

    async ReloadSubs() {
        const subs = this.LoadedSubtitles?.subtitles
        if (subs) {
            subs.jpdbParse = undefined // these get reloaded from cache if possible
            await this.LoadSubtitles(subs)
        }
    }

    async LoadSubtitles(subtitles: Subtitles) {
        const skip: [start: number, end?: number][] = []
        if (this.MpvWebSocket?.Open) {
            const skipChapterRegex = await getSetting("skipChapterRegex")
            if (skipChapterRegex) {
                const regex = new RegExp(skipChapterRegex)
                // bit inefficient but probably good
                const resp = await this.MpvWebSocket.RequestIfOpen(`ipc-request:["get_property", "chapter-list"]`)
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


        this.LoadedSubtitles?.Node.remove()

        const viewer = new SubtitleViewer(subtitles, this)
        this.SubtitleContainer.append(viewer.Node)
        viewer.UpdateHighlighting(this.CurrentTime)

        this.LoadedSubtitles = viewer
        viewer.JumpTo(viewer.LatestEntry(this.CurrentTime))
        JpdbParseSubtitles(this.LoadedSubtitles.subtitles, true)
    }
    async HandleWebSocketData(webSocket: MpvWebSocket, command: string | Blob) {
        if (typeof command === "string") {
            const spl = command.indexOf(":")
            if (spl === -1) { console.error({ command, message: "Missing :" }); return }
            const commandName = command.substring(0, spl);
            const commandValue = command.substring(spl + 1);
            await this.HandleCommandAndData(webSocket, commandName, commandValue)
        } else {
            const bytes = new Uint8Array(await command.arrayBuffer());
            const spl = bytes.indexOf(":".charCodeAt(0))
            if (spl === -1) return
            const commandName = new TextDecoder().decode(bytes.subarray(0, spl));
            await this.HandleCommandAndData(webSocket, commandName, bytes.subarray(spl + 1))
        }
    }
    async RequestAndLoadSubs(webSocket: MpvWebSocket) {
        const subs = await webSocket.RequestIfOpen("jp-subs")
        if (typeof subs === "string") throw new Error()
        const decoded = new TextDecoder().decode(subs)
        await this.LoadSubtitles(await parseSrt(decoded))
    }
    async HandleCommandAndData(webSocket: MpvWebSocket, commandName: string, commandData: string | Uint8Array<ArrayBuffer>) {
        if (commandName === "time" || commandName === "t") {
            this.UpdateTime(parseFloat(commandData as string))
        } else if (commandName === "response") {
            await webSocket.HandleResponse(commandData)
        } else if (commandName === "current-file") {
            if (typeof commandData === "string") {
                if (commandData !== this.CurrentFilename) {
                    this.CurrentFilename = commandData
                    if (commandData) await this.RequestAndLoadSubs(webSocket)
                }
            }
        }
    }
    SeekToSubtitle(entry: SubtitleEntry) {
        if (this.MpvWebSocket?.Open)
            this.MpvWebSocket.SendIfOpen(`ipc:seek ${entry.startTime / 1000} absolute`)
        else this.UpdateTime(entry.startTime)
    }

    GetNextEntryIndex(entries: SubtitleEntry[], backwards: boolean) {
        if (backwards) {
            for (let i = 1; i < entries.length; i++) {
                if (entries[i].endTime > this.CurrentTime) {
                    return i - 1
                }
            }
            return entries.length - 1
        } else {
            for (let i = 0; i < entries.length; i++) {
                if (entries[i].startTime > this.CurrentTime) {
                    return i
                }
            }
            return entries.length - 1
        }
    }
    SeekToNextEntry(entries: SubtitleEntry[], backwards: boolean) {
        // TODO add epsilon
        // const epsilon = 200 // ms
        if (!this.MpvWebSocket) return
        const index = this.GetNextEntryIndex(entries, backwards)
        this.SeekToSubtitle(entries[index])
        return index
    }
}
