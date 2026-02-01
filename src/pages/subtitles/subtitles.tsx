import { Subtitles, formatTimestamp, SubtitleEntryWithCharacterOffset, SubtitleEntry, OffsetCache, parseSubtitles } from "../../utils/srt"
import MpvWebSocket from "../../utils/MpvWebSocket"
import SubtitleViewer from "./SubtitleViewer"
import { disallowGlobalInput, handleKeyDown } from "../../utils/GlobalHotkeys"
import MiningModal from "../../components/MiningModal"
import { Modal } from "../../components/Modal"
import IconButton, { IconButtonClass } from "../../components/basic/IconButton"
import SettingsModal, { getSetting, onSettingChange, removeOnSettingChange, setSetting } from "../../views/SettingsModal"
import { applyReplacementsTo, getReplacements } from "../../views/RegexReplacements"
import { JpdbParseResponse, JpdbParseSubtitles } from "../../jpdb/JpdbParseText"
import RecommendedMiningModal from "./RecommendedMiningModal"
import { getCharacterIndex } from "../../utils/CharacterHighlighter"
import { PageComponent } from "../../framework/PageComponent"
import { Children, replaceChildren } from "../../framework/createElement"
import { ErrorDisplay } from "../../utils/UserError"
import { ActionTooltip } from "../../framework/Tooltips"
import LoadingButton from "../../components/LoadingButton"

export default class SubtitlesPage extends PageComponent {
    Id = "subs-page"
    Node: Children
    override Title = "Mining Helper - Subtitles"

    CurrentFilename?: string
    CurrentTime = 0
    LoadedSubtitles: SubtitleViewer | undefined
    readonly MpvWebSocket: MpvWebSocket = new MpvWebSocket()
    LoadFromClipboard = async () => {
        const clipboard = await navigator.clipboard.readText()
        return this.LoadFromString(clipboard)
    }
    LoadFromString = async (s: string, filename?: string) => {
        if (!s) return
        if (s.startsWith("https://")) {
            return this.LoadSubtitles(async () => {
                if (!s.endsWith(".srt") && !s.endsWith(".ass"))
                    throw new Error("URL does not end in .srt or .ass")
                const resp = await fetch(s)
                if (!resp.ok) throw new Error(`Failed to fetch ${s}\nStatus: ${resp.status}`)
                const body = await resp.text()
                return parseSubtitles(body, s)
            })
        } else {
            return this.LoadSubtitles(() => parseSubtitles(s, filename))
        }
    }
    // TODO add click to open file select with (lazy) hidden <input/>
    DropTarget: HTMLElement | undefined = <div id="subtitle-drop-target">
        <div className="drop-target-border" />
        <span className="primary-text">Drop an .srt or .ass file here to load</span>
        <span className="sub-text">
            https links (ie. from <a target="_blank" href="https://jimaku.cc" rel="noopener noreferrer">jimaku</a>)
            and pasting (Ctrl+V) are also supported
        </span>
        <div className="button-group">
            <button>Select File</button>
            <LoadingButton tooltip="May request browser permissions"
                onClick={this.LoadFromClipboard}>Load From Clipboard</LoadingButton>
        </div>
    </div>
    SubtitleContainer = <div id="subtitle-container" />
    InnerBodyContainer = <div id="inner-body-container">
        {this.SubtitleContainer}
        {this.DropTarget}
    </div>
    TimeElement = <span id="current-time">00:00</span>
    MiningModal?: Modal

    override Dispose() {
        removeOnSettingChange("offset", this.OffsetChanged)
        removeOnSettingChange("regexReplacements", this.ReloadSubs)
        removeOnSettingChange("skipChapterRegex", this.ReloadSubs)
        document.removeEventListener("keydown", this.DocumentKeydown)
        document.removeEventListener("paste", this.DocumentPaste)
        this.MpvWebSocket.Connection?.close()
    }

    HandleDataTransfer(dt: DataTransfer | null) {
        if (!dt) return
        const files = dt.files
        if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                if (file.name.endsWith(".srt") || file.name.endsWith(".ass")) {
                    const reader = new FileReader()
                    reader.onload = async e => {
                        const target = e.target
                        const res = target?.result
                        if (typeof res === "string") {
                            this.LoadFromString(res, file.name)
                        }
                    }
                    reader.readAsText(file)
                }
            }
        } else {
            const uri = dt.getData("text/uri-list")
            if (uri) return this.LoadFromString(uri)
            const plain = dt.getData("text/plain")
            if (plain) return this.LoadFromString(plain)
        }
    }

    DocumentPaste = (ev: ClipboardEvent) => {
        if (this.LoadedSubtitles) return
        ev.preventDefault()
        return this.HandleDataTransfer(ev.clipboardData)
    }

    OffsetChanged = (offset: number) => {
        const subs = this.LoadedSubtitles?.subtitles
        if (subs) {
            if ((subs.offset ?? 0) !== offset) {
                subs.offset = offset
                this.ReloadSubs()
            }
        }
    }

    TryMine() {
        if (this.MiningModal) {
            this.MiningModal.Close()
        } else {
            // TODO if selection is collapsed, we should prioritze the hover element in the SubtitleViewer
            // the hover token is easily gettable, but we'd have to rework most of the code below here
            const selected = getSelection()
            if (selected) {
                const anchor = selected.anchorNode?.parentElement as HTMLElement | undefined
                if (!anchor) throw "Nothing selected"
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
        } else if (key === ",") {
            SettingsModal()
        } else if (key === "m") {
            this.TryMine()
        } else if (key === "t") {
            this.TryJpdbParse()
        } else if (key === "y") {
            const subs = this.LoadedSubtitles?.subtitles
            if (subs) {
                (async () => {
                    const modal = await RecommendedMiningModal(subs, () => {
                        const main = this.LoadedSubtitles?.Node
                        if (!main) return
                        // couldn't really think of a nice way to grab this without id
                        // we could store it as a field in the layout, but we don't even have access to a layout instance here
                        // even if we did, we can't trust that the layout would be an "instance"
                        //   (since it could be a simple render function instance)
                        const header = document.getElementById("mh-header")
                        if (!header) return
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
    }

    JpdbParsePromise?: Promise<JpdbParseResponse | undefined>
    async TryJpdbParse() {
        if (this.LoadedSubtitles) {
            if (!this.JpdbParsePromise) {
                this.JpdbLoadButton.Loading = true
                this.JpdbParsePromise = JpdbParseSubtitles(this.LoadedSubtitles.subtitles)
                    .then(e => {
                        this.JpdbLoadButton.Disabled = true
                        return e
                    })
                    .finally(() => {
                        this.JpdbLoadButton.Loading = false
                        this.JpdbParsePromise = undefined
                    })
            }
        }
        return this.JpdbParsePromise
    }

    JpdbLoadButton = IconButtonClass({
        icon: "document_search", onClick: () => this.TryJpdbParse(),
        tooltip: ActionTooltip("Parse File", "T", "Parses the loaded subtitle file using jpdb's API")
    })

    MiningButton = IconButtonClass({
        icon: "edit", onClick: () => this.TryMine(),
        tooltip: ActionTooltip("Mine Selection", "M", "Create an Anki card based on the selected text")
    })

    constructor() {
        super()

        onSettingChange("offset", this.OffsetChanged)
        onSettingChange("regexReplacements", this.ReloadSubs)
        onSettingChange("skipChapterRegex", this.ReloadSubs)


        const connectionDot = <div id="connection-status-dot" onclick={ev => {
            this.MpvWebSocket.Connect();
            ev.preventDefault();
        }} />
        // wrapper is nice just to offset the tooltip
        const connectionDotWrapper = <div id="connection-status-dot-wrapper">{connectionDot}</div>
        this.Node = <>
            <div id="status-info">
                {this.MiningButton}
                {this.JpdbLoadButton}
                <IconButton icon="settings" onClick={() => SettingsModal()} tooltip={ActionTooltip("Open Settings", ",")} />
                {this.TimeElement}
                {connectionDotWrapper}
            </div>
            {this.InnerBodyContainer}
        </>
        this.MpvWebSocket.onMessage = (e) => this.HandleWebSocketData(this.MpvWebSocket, e.data)
        this.MpvWebSocket.onConnecting = () => {
            connectionDotWrapper.tooltip = "WebSocket connecting"
            connectionDot.classList.remove(...connectionDot.classList);
        }
        this.MpvWebSocket.onOpen = () => {
            connectionDotWrapper.tooltip = "WebSocket connected"
            connectionDot.classList.add("connected")
            connectionDot.classList.remove("disconnected")
        }
        this.MpvWebSocket.onClose = skipped => {
            if (skipped) {
                connectionDotWrapper.tooltip = "No API key specified\nClick to try anyways"
            } else {
                connectionDotWrapper.tooltip = "WebSocket disconnected\nClick to retry"
            }
            connectionDot.classList.remove("connected")
            connectionDot.classList.add("disconnected")
        }
        this.MpvWebSocket.Connect(true)

        document.addEventListener("keydown", this.DocumentKeydown)
        document.addEventListener("paste", this.DocumentPaste)

        this.InnerBodyContainer.addEventListener("dragover", ev => {
            ev.preventDefault()
            if (ev.dataTransfer) ev.dataTransfer.dropEffect = "link"
        })
        this.InnerBodyContainer.addEventListener("drop", ev => {
            ev.preventDefault()
            this.DropTarget?.classList.remove("drag-enter")
            return this.HandleDataTransfer(ev.dataTransfer)
        })
        this.InnerBodyContainer.addEventListener("dragenter", ev => {
            this.DropTarget?.classList.add("drag-enter")
        })
        this.InnerBodyContainer.addEventListener("dragleave", ev => {
            // otherwise it triggers for leaving children
            if (ev.target === ev.currentTarget)
                this.DropTarget?.classList.remove("drag-enter")
        })
    }

    UpdateTime(timestamp: number) {
        this.CurrentTime = timestamp
        const text = formatTimestamp(this.CurrentTime)
        // this saves some DOM node churn
        if (text !== this.TimeElement.textContent)
            this.TimeElement.textContent = formatTimestamp(this.CurrentTime)
        this.LoadedSubtitles?.UpdateHighlighting(this.CurrentTime)
    }

    ReloadSubs = async () => {
        const subs = this.LoadedSubtitles?.subtitles
        if (subs) {
            subs.jpdbParse = undefined // these get reloaded from cache if possible
            await this.LoadSubtitles(() => subs)
        }
    }

    ShowError(error: Children) {
        if (this.DropTarget) {
            let errorContainer = this.DropTarget.querySelector(".error-container")
            if (!errorContainer) this.DropTarget.append(errorContainer = <div className="error-container" />)
            replaceChildren(errorContainer, error)
        } else {
            replaceChildren(this.SubtitleContainer, error)
        }
    }

    async LoadSubtitles(getSubs: () => (Promise<Subtitles> | Subtitles)) {
        let subtitles: Subtitles
        try {
            subtitles = await getSubs()
        } catch (e: unknown) {
            this.ShowError(ErrorDisplay(`Failed to load subs.\n${String(e)}`))
            return
        }
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
        this.SubtitleContainer.replaceChildren(viewer.Node)
        this.DropTarget?.remove()
        this.DropTarget = undefined
        viewer.UpdateHighlighting(this.CurrentTime)

        this.LoadedSubtitles = viewer
        viewer.JumpTo(viewer.LatestEntry(this.CurrentTime))
        JpdbParseSubtitles(this.LoadedSubtitles.subtitles, true)
            .then(() => this.JpdbLoadButton.Disabled = Boolean(subtitles.jpdbParse))
        setSetting("offset", offset) // set at the end to avoid triggering event handlers
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
        await this.LoadSubtitles(async () => {
            const subs = await webSocket.RequestIfOpen("jp-subs")
            if (typeof subs === "string") throw new Error()
            const decoded = new TextDecoder().decode(subs)
            return parseSubtitles(decoded)
        })
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
