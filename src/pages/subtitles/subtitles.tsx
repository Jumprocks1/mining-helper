import { Subtitles, formatTimestamp, SubtitleEntryWithCharacterOffset, SubtitleEntry, OffsetCache, parseSubtitles } from "../../utils/srt"
import MpvWebSocket from "../../utils/MpvWebSocket"
import SubtitleViewer from "./SubtitleViewer"
import { disallowGlobalInput, handleKeyDown } from "../../utils/GlobalHotkeys"
import MiningModal from "../../components/MiningModal"
import { Modal, OpenModal } from "../../components/Modal"
import IconButton, { IconButtonClass } from "../../components/basic/IconButton"
import SettingsModal, { getSetting, onSettingChange, removeOnSettingChange, setSetting } from "../../views/SettingsModal"
import { applyReplacementsTo, getReplacements } from "../../views/RegexReplacements"
import { JpdbParseResponse, JpdbParseSubtitles } from "../../jpdb/JpdbParseText"
import RecommendedMiningModal from "./RecommendedMiningModal"
import { getCharacterIndex } from "../../utils/CharacterHighlighter"
import { PageComponent } from "../../framework/PageComponent"
import { Children, replaceChildren } from "../../framework/createElement"
import UserError, { ErrorDisplay } from "../../utils/UserError"
import { ActionTooltip } from "../../framework/Tooltips"
import LoadingButton from "../../components/LoadingButton"
import Select from "../../components/Select"

export default class SubtitlesPage extends PageComponent {
    Id = "subs-page"
    Node: Children
    override Title = "Mining Helper - Subtitles"

    CurrentFilename?: string
    CurrentTime = 0
    LoadedSubtitles: SubtitleViewer | undefined
    readonly MpvWebSocket: MpvWebSocket = new MpvWebSocket()
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
    FileInput = <input type="file" hidden accept=".srt,.ass" onchange={() => {
        if (this.FileInput.files) {
            this.HandleFiles(this.FileInput.files)
            this.FileInput.value = "" // reset for more files
        }
    }} /> as HTMLInputElement
    DropTarget: HTMLElement | undefined = <div id="subtitle-drop-target" onclick={() => this.FileInput.click()}>
        <div className="drop-target-border" />
        <span className="primary-text">Drop an .srt or .ass file here to load</span>
        <span className="sub-text">
            https links (ie. from <a target="_blank" href="https://jimaku.cc" rel="noopener noreferrer">jimaku</a>)
            and pasting (Ctrl+V) are also supported
        </span>
        <div className="button-group">
            <button>Select File</button>
            <LoadingButton tooltip="May request browser permissions"
                onClick={async ev => {
                    ev.preventDefault()
                    ev.stopPropagation()
                    // sadly clipboard.read() doesn't really help here
                    // it *can* read something like raw image data (from print screen),
                    //    but it can't currently read a copied file from Windows file explorer.
                    // the "paste" event is different and much more powerful
                    const clipboard = await navigator.clipboard.readText()
                    return this.LoadFromString(clipboard)
                }}>Load From Clipboard</LoadingButton>
        </div>
        {this.FileInput}
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
        removeOnSettingChange("skipAssStyleRegex", this.ReloadSubs)
        removeOnSettingChange("skipChapterRegex", this.ReloadSubs)
        document.removeEventListener("keydown", this.DocumentKeydown)
        document.removeEventListener("paste", this.DocumentPaste)
        this.MpvWebSocket.Connection?.close()
    }

    HandleFiles(files: FileList) {
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
                return
            }
        }
    }

    HandleDataTransfer(dt: DataTransfer | null) {
        if (!dt) return
        const files = dt.files
        if (files && files.length > 0) {
            this.HandleFiles(files)
        } else {
            const uri = dt.getData("text/uri-list")
            if (uri) return this.LoadFromString(uri)
            const plain = dt.getData("text/plain")
            if (plain) return this.LoadFromString(plain)
        }
    }

    DocumentPaste = (ev: ClipboardEvent) => {
        if (this.LoadedSubtitles) return
        function isEditable(el: HTMLElement) {
            return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable
        }
        if (isEditable(ev.target as HTMLElement)) return
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
                    this.MpvWebSocket.SendIfOpen(`seek:${entry.startTime}`)
                    this.MpvWebSocket.SendIfOpen("show-subs")
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
                        this.MpvWebSocket.SendIfOpen(`seek:${entries[i].startTime}`)
                        ev.preventDefault();
                        break
                    }
                }
            }
        }

        if (key === "h") {
            this.LoadedSubtitles?.HighlightAnkiWords()
        } else if (key === "u") {
            this.LoadedSubtitles?.UnderlineWords()
        } else if (key === "i") { // i for info?
            this.LoadedSubtitles?.ToggleShift()
        } else if (key === "v") {
            this.MpvWebSocket.SendIfOpen("toggle-subs");
        } else if (key === " ") {
            this.MpvWebSocket.SendIfOpen("toggle-pause");
            ev.preventDefault()
        } else if (key === ",") {
            SettingsModal()
        } else if (key === "m") {
            this.TryMine()
        } else if (key === "t") {
            this.TryJpdbParse()
        } else if (key === "y") {
            this.TryRecommendedMiningModal()
        }
    }

    RecommendedMiningModalPromise?: Promise<void>
    async TryRecommendedMiningModal() {
        const subs = this.LoadedSubtitles?.subtitles
        if (subs && !this.RecommendedMiningModalPromise) {
            this.RecommendedMiningModalPromise = (async () => {
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
            })().finally(() => this.RecommendedMiningModalPromise = undefined)
            this.RecommendedMiningButton.waitFor(this.RecommendedMiningModalPromise, true)
        }
        return this.RecommendedMiningModalPromise
    }

    JpdbParsePromise?: Promise<JpdbParseResponse | undefined>
    async TryJpdbParse() {
        if (this.LoadedSubtitles) {
            if (!this.JpdbParsePromise) {
                this.JpdbParsePromise = JpdbParseSubtitles(this.LoadedSubtitles.subtitles)
                    .then(e => {
                        this.JpdbLoadButton.Disabled = true
                        return e
                    })
                    .finally(() => {
                        this.JpdbParsePromise = undefined
                    })
                this.JpdbLoadButton.waitFor(this.JpdbParsePromise, true)
            }
        }
        return this.JpdbParsePromise
    }

    JpdbLoadButton = IconButtonClass({
        icon: "document_search", onClick: () => this.TryJpdbParse(), disabled: true,
        tooltip: ActionTooltip("Parse File", "T", "Parses the loaded subtitle file using jpdb's API")
    })
    RecommendedMiningButton = IconButtonClass({
        icon: "format_list_numbered", onClick: () => this.TryRecommendedMiningModal(), disabled: true,
        tooltip: ActionTooltip("Recommended Mining", "Y", "Recommends words/sentences to mine from the loaded subtitle file."
            + "\nRelies on word frequency (jpdb) and your existing Anki cards.")
    })
    MiningButton = IconButtonClass({
        icon: "edit", onClick: () => this.TryMine(), disabled: true,
        tooltip: ActionTooltip("Mine Selection", "M", "Create an Anki card based on the selected text")
    })
    ChangeSubs = IconButtonClass({
        icon: "subtitles_gear", onClick: async () => {
            const tracks = await this.MpvWebSocket.SubtitleTrackList()
            if (tracks) {
                const modal = OpenModal({
                    body: () => {
                        const select = Select({
                            unsetLabel: "Please select a track",
                            onChange: async value => {
                                modal.Close()
                                await this.LoadSubtitles(async () => {
                                    const subs = await this.MpvWebSocket.RequestIfOpen(`get-subs:${value}`)
                                    return parseSubtitles(subs)
                                })
                            },
                        })
                        for (const track of tracks) {
                            let title = `${track.title ? track.title + " " : ""} (${track.lang ? track.lang + " " : ""}${track.codec})`
                            if (track.selected) title += " [selected]"
                            if (track.default) title += " [default]"
                            if (track.forced) title += " [forced]"
                            if (track.external) title += " [external]"
                            select.Node.append(<option value={track.id.toString()}>{title}</option>)
                        }
                        return select.Node
                    },
                    header: "Changing Subtitle Track"
                })
            }
        },
        tooltip: ActionTooltip("Change Subtitle Track")
    })

    constructor() {
        super()

        onSettingChange("offset", this.OffsetChanged)
        onSettingChange("regexReplacements", this.ReloadSubs)
        onSettingChange("skipAssStyleRegex", this.ReloadSubs)
        onSettingChange("skipChapterRegex", this.ReloadSubs)


        // wrapper is nice just to offset the tooltip
        const connectionDot = <div id="connection-status-dot-wrapper" onclick={ev => {
            this.MpvWebSocket.Connect();
            ev.preventDefault();
        }}>
            <div id="connection-status-dot" />
        </div>
        this.Node = <>
            <div id="status-info">
                {this.ChangeSubs}
                {this.MiningButton}
                {this.JpdbLoadButton}
                {this.RecommendedMiningButton}
                <IconButton icon="settings" onClick={() => SettingsModal()} tooltip={ActionTooltip("Open Settings", ",")} />
                {this.TimeElement}
                {connectionDot}
            </div>
            {this.InnerBodyContainer}
        </>
        this.MpvWebSocket.onMessage = (e) => this.HandleWebSocketData(this.MpvWebSocket, e.data)
        this.MpvWebSocket.onConnecting = () => {
            connectionDot.tooltip = "WebSocket connecting"
            connectionDot.classList.remove(...connectionDot.classList);
        }
        this.MpvWebSocket.onOpen = () => {
            connectionDot.tooltip = "WebSocket connected"
            connectionDot.classList.add("connected")
            connectionDot.classList.remove("disconnected")
        }
        this.MpvWebSocket.onClose = skipped => {
            if (skipped) {
                connectionDot.tooltip = "No API key specified\nClick to try anyways"
            } else {
                connectionDot.tooltip = "WebSocket disconnected\nClick to retry"
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
            this.InnerBodyContainer.classList.remove("drag-enter")
            return this.HandleDataTransfer(ev.dataTransfer)
        })
        this.InnerBodyContainer.addEventListener("dragenter", ev => {
            this.InnerBodyContainer.classList.add("drag-enter")
        })
        this.InnerBodyContainer.addEventListener("dragleave", ev => {
            // otherwise it triggers for leaving children
            if (ev.relatedTarget === null || !this.InnerBodyContainer.contains(ev.relatedTarget as Node))
                this.InnerBodyContainer.classList.remove("drag-enter")
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

    // this helps when LoadSubtitles is called too fast
    // still not 100% sure it's perfect, but so far it's fixed the main case of spamming the scroll wheel on the offset setting
    LoadController?: AbortController
    async LoadSubtitles(getSubs: () => (Promise<Subtitles> | Subtitles)) {
        this.LoadController?.abort();
        this.LoadController = new AbortController()
        const signal = this.LoadController.signal
        let subtitles: Subtitles
        try {
            subtitles = await getSubs()
            if (subtitles.originalEntries.length === 0) throw "No subtitles found"
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
                const resp = await this.MpvWebSocket.RequestIfOpen("chapter-list")
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

        let skipStyleRegex: RegExp | undefined = undefined
        if (subtitles.styles && subtitles.styles.length > 0) {
            const skipRegexString = await getSetting("skipAssStyleRegex")
            if (skipRegexString) skipStyleRegex = new RegExp(skipRegexString)
        }

        const offset = subtitles.offset ?? 0
        const replacements = await getReplacements()
        const res: SubtitleEntryWithCharacterOffset[] = []

        let previous: SubtitleEntryWithCharacterOffset | undefined

        let characterOffset = 0
        for (const entry of subtitles.originalEntries) {
            const text = applyReplacementsTo(replacements, entry.text).trim()
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
            if (skipStyleRegex && entry.style && skipStyleRegex.test(entry.style))
                continue
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

        if (signal.aborted) return

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
        this.JpdbLoadButton.Disabled = Boolean(subtitles.jpdbParse)
        this.RecommendedMiningButton.Disabled = false
        this.MiningButton.Disabled = false
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
            return parseSubtitles(subs)
        })
    }
    async HandleCommandAndData(webSocket: MpvWebSocket, commandName: string, commandData: string | Uint8Array<ArrayBuffer>) {
        if (commandName === "time" || commandName === "t") {
            this.UpdateTime(parseFloat(commandData as string))
        } else if (commandName === "response") {
            await webSocket.HandleResponse(commandData)
        } else if (commandName === "response-error" && typeof commandData === "string") {
            const spl = commandData.indexOf(":")
            const requestId = commandData.substring(0, spl);
            const commandValue = commandData.substring(spl + 1);
            const request = webSocket.pendingRequests.get(requestId)
            if (request) {
                request.err(new UserError(commandValue))
                webSocket.pendingRequests.delete(requestId)
            }
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
            this.MpvWebSocket.SendIfOpen(`seek:${entry.startTime}`)
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
