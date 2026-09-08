import IconButton, { IconButtonClass } from "../../components/basic/IconButton"
import Loader from "../../components/Loader"
import { OpenModal } from "../../components/Modal"
import Select from "../../components/Select"
import { furiganaModes, getSetting, setSetting } from "../../core/Settings"
import { EpubReader } from "../../reader/EpubReader"
import epubJpdb from "../../reader/epubJpdb"
import { replaceChildren, replaceWith } from "../../framework/createElement"
import { PageComponent } from "../../framework/PageComponent"
import { ActionTooltip } from "../../framework/Tooltips"
import { JpdbToken } from "../../jpdb/JpdbParseText"
import { disallowGlobalInput, handleKeyDown } from "../../utils/GlobalHotkeys"
import { JpdbApiKeyField } from "../../views/SettingsFields"
import { getAnkiFurigana } from "../anki/CardList"
import { HoverRectangleContainer, JpHoverTooltipHandler, RegisterJpHoverTooltip, UpdateHoverBox, UpdateJpHover } from "../subtitles/JpHoverTooltip"
import { AddFurigana } from "./furigana"
import { BaseReader, EpubPage } from "../../reader/BaseReader"
import readBlob, { BlobLike, blobLikeToBlob } from "../../reader/readBlob"

const currentPositionKey = "reader-progress"

export default class ReaderPage extends PageComponent {
    Id = "reader-page"
    override Title = "Mining Helper - Reader"
    override Node: HTMLElement

    CurrentPageNode: EpubPage = <div>Drop .epub here</div> as EpubPage
    HoverRectangleContainer = HoverRectangleContainer()
    PageWrapper = <div id="epub-page-wrapper">
        {this.CurrentPageNode}
        {this.HoverRectangleContainer}
    </div>
    ViewerNode: HTMLElement = <div id="epub-viewer">{this.PageWrapper}</div>
    PageIndicator: HTMLElement = <div id="page-indicator" tooltip={() => this.PageTooltip()}>0 / 0</div>
    ToCBody: HTMLElement = <div />
    ToC: HTMLElement = <div id="toc">
        <h3>Table of Contents</h3>
        {this.ToCBody}
    </div>
    Reader?: BaseReader
    FullscreenButton = <IconButton icon="fullscreen" onClick={() => this.ToggleFullscreen()}
        tooltip={ActionTooltip("Fullscreen")} />

    JpdbLoadButton = IconButtonClass({
        icon: "document_search", onClick: async () => {
            await epubJpdb(this.CurrentPageNode)
            if (this.CurrentPageNode.jpdb) this.JpdbLoadButton.Disabled = true
        },
        tooltip: ActionTooltip("Parse File", "T", "Parses the current page using jpdb's API")
    })
    FuriganaButton = IconButtonClass({
        icon: "text_select_move_up", onClick: async () => {
            await this.JpdbLoadButton.Click(undefined)
            const jpdb = this.CurrentPageNode.jpdb
            if (!jpdb) return
            await AddFurigana(jpdb)
            this.FuriganaButton.Disabled = true
        },
        tooltip: ActionTooltip("Add Furigana", "F", "Adds furigana above kanji\nBy default, only shows furigana for unknown kanji/vocab\nCan be configured in settings")
    })

    constructor() {
        super()

        const body = <>
            <div id="status-info">
                <div className="row">
                    {this.FuriganaButton}
                    {this.JpdbLoadButton}
                    {this.FullscreenButton}
                    <IconButton icon="settings" onClick={() => OpenReaderSettings()} tooltip={ActionTooltip("Open Settings", ",")} />
                </div>
                <div className="row">
                    {this.PageIndicator}
                </div>
                <div className="row">
                    <IconButton onClick={async () => {
                        if (!this.Reader) return
                        await this.LoadPage(this.ProgressState.page - 1)
                    }} icon="arrow_back" tooltip={ActionTooltip("Previous Page", "←")} />
                    <IconButton onClick={async () => {
                        if (!this.Reader) return
                        await this.LoadPage(this.ProgressState.page + 1)
                    }} icon="arrow_forward" tooltip={ActionTooltip("Next Page", "→")} />
                </div>
            </div>
            {this.ToC}
            {this.ViewerNode}
        </>
        this.Node = body


        document.addEventListener("keydown", this.DocumentKeydown)

        // TODO can share a lot of this with subtitles.tsx
        this.ViewerNode.addEventListener("dragover", ev => {
            ev.preventDefault()
            if (ev.dataTransfer) ev.dataTransfer.dropEffect = "link"
        })
        this.ViewerNode.addEventListener("drop", ev => {
            ev.preventDefault()
            return this.HandleDataTransfer(ev.dataTransfer)
        })
        getAnkiFurigana()
    }

    Cache?: Cache

    PageTooltip() {
        if (!this.Reader || !(this.Reader instanceof EpubReader)) return
        const currentPage = this.ProgressState.page
        const spine = this.Reader.spine[currentPage]
        return spine.href
    }

    override Load = async () => {
        this.Cache = await caches.open("reader")
        const response = await this.Cache.match(`https://jumprocks1.github.io/_/epub/recent`)
        if (response) {
            await this.LoadEpubFileBlob(await response.blob())
        }

        // if this is called before the page is synchronously loaded,
        //  it risks getting unbound due to how onDeath works
        // would prefer to call this during the constructor if I fix that issue
        // that would allow TooltipHandler to be non-undefined
        this.TooltipHandler = RegisterJpHoverTooltip({
            body: this.PageWrapper,
            getTargetAndVocab: hovered => {
                const jpdb = this.CurrentPageNode?.jpdb
                if (!jpdb) return
                // ends up 1 longer than the jpdb parse text if no match due to extra newline at end
                let found: number | undefined
                let n = 0
                for (let i = 0; i < jpdb.nodes.length; i++) {
                    const e = jpdb.nodes[i]
                    if (e === hovered[0]) {
                        found = i
                        break
                    }
                    n += e.textContent.length;
                }
                if (found === undefined) return
                const offset = n + hovered[1] // exact position we are hovering in jpdb parse string
                let token: JpdbToken | undefined = undefined
                // this could be sped up with binary search
                for (let i = 0; i < jpdb.tokens.length; i++) {
                    const e = jpdb.tokens[i]
                    if (e[0] <= offset && e[0] + e[1] > offset) {
                        token = e
                    }
                }
                if (!token) return
                const range = document.createRange()
                // Goal here is to figure out which nodes the token belongs to
                // At this point, we know the hovered node (index `found`) is part of the token
                // We don't know if other nodes before/after `found` are also part of the token
                const tokenStart = token[0]
                const tokenEnd = tokenStart + token[1]
                let p = n
                for (let i = found; i >= 0; i--) {
                    const e = jpdb.nodes[i]
                    if (p <= tokenStart && tokenStart < p + e.textContent.length) {
                        range.setStart(e, tokenStart - p)
                        break
                    }
                    if (i > 0) p -= jpdb.nodes[i - 1].textContent.length
                }
                p = n
                for (let i = found; i < jpdb.nodes.length; i++) {
                    const e = jpdb.nodes[i]
                    if (p < tokenEnd && tokenEnd <= p + e.textContent.length) {
                        range.setEnd(e, tokenEnd - p)
                        break
                    }
                    p += e.textContent.length
                }

                if (range.startContainer === document || range.endContainer === document) {
                    console.error("failed to locate nodes")
                    return
                }
                return [range, jpdb.vocabulary[token[3]], token]
            },
            invert: false,
            onChange: state => UpdateHoverBox(this.HoverRectangleContainer, state)
        })
    }

    // TODO rename all epub stuff in this file
    async LoadEpubFileBlob(blob: Blob) {
        // TODO would be good to use an actual Loader call here - this would give support for error handling on page load
        // Might be weird if it's nested within an outer loader on inital page load though
        const node = <div className="loader" /> as EpubPage
        replaceWith(this.CurrentPageNode!, node)
        this.CurrentPageNode = node
        this.Reader = await readBlob(blob)
        this.LoadToC()
        await this.LoadPage(this.ProgressState.page, true)
    }

    ProgressState = this.GetSavedState()

    GetSavedState(): {
        page: number,
        paragraphs: Record<number, number | undefined> // map of page => paragraph progress
    } {
        // TODO this will need something per epub file
        const s = localStorage.getItem(currentPositionKey)
        if (s) {
            try {
                const o = JSON.parse(s)
                if (!o.paragraphs) o.paragraphs = {}
                return o
            } catch { }
        }
        return { page: 0, paragraphs: {} }
    }
    SavePageState() {
        localStorage.setItem(currentPositionKey, JSON.stringify(this.ProgressState))
    }

    async LoadPage(page: number, initial: boolean = false) {
        if (!this.Reader) return
        const totalPages = this.Reader.PageCount
        page = Math.max(Math.min(page, totalPages - 1), 0)
        if (page === this.ProgressState.page && !initial) return
        this.JpdbLoadButton.Disabled = true
        this.FuriganaButton.Disabled = true
        this.PageIndicator.textContent = `${page + 1} / ${totalPages}`
        if (this.ProgressState.page !== page) {
            this.ProgressState.page = page
            this.SavePageState()
        }
        const pageNode = await this.Reader.ReadPage(page)
        this.EnhancePageNode(pageNode)
        // Make there's no important awaits after this call, otherwise we'll get a layout shift
        replaceWith(this.CurrentPageNode, pageNode)
        this.CurrentPageNode = pageNode

        if (this.Reader instanceof EpubReader) {
            const tocPoints = this.ToC.querySelectorAll(".toc-point")
            const toc = this.Reader.toc
            for (let i = 0; i < tocPoints.length; i++) {
                const e = toc.points[i]
                const nextTocPage = i < toc.points.length - 1 ? toc.points[i + 1].spinePage : this.Reader.spine.length
                tocPoints.item(i).classList.toggle("active", page >= e.spinePage && page < nextTocPage)
            }
        }
        const paragraph = this.ProgressState.paragraphs[page] ?? 0
        if (paragraph === 0) {
            this.ViewerNode.scrollTo({ top: 0 })
        } else {
            this.OnAfterLoad(() => pageNode.querySelector("p.saved-position")?.scrollIntoView({ block: "center" }))
        }
        await epubJpdb(pageNode, true)
        this.JpdbLoadButton.Disabled = Boolean(pageNode.jpdb)
        this.FuriganaButton.Disabled = false
    }

    async NextParagraph(invert: boolean) {
        if (!this.Reader) return
        const oldParagraph = this.ProgressState.paragraphs[this.ProgressState.page] ?? 0
        const newParagraph = oldParagraph + (invert ? -1 : 1)
        const totalParagraphs = this.CurrentPageNode.querySelectorAll("p")
        if (newParagraph < 0)
            return this.LoadPage(this.ProgressState.page - 1)
        if (newParagraph >= totalParagraphs.length)
            return this.LoadPage(this.ProgressState.page + 1)
        this.ProgressState.paragraphs[this.ProgressState.page] = newParagraph
        let oldParagraphNode: HTMLElement | undefined
        let newParagraphNode: HTMLElement | undefined
        for (const p of this.CurrentPageNode.querySelectorAll("p")) {
            p.classList.toggle("saved-position", p.paragraphIndex === newParagraph)
            if (p.paragraphIndex === oldParagraph) oldParagraphNode = p
            else if (p.paragraphIndex === newParagraph) newParagraphNode = p
        }
        if (oldParagraphNode && newParagraphNode) {
            this.ViewerNode.scrollBy(0, newParagraphNode.getBoundingClientRect().top - oldParagraphNode.getBoundingClientRect().top)
        }
        this.SavePageState() // TODO this is also called inside LoadPage
    }

    LoadToC() {
        const reader = this.Reader
        if (!reader || !(reader instanceof EpubReader)) return
        const toc = reader.toc
        const o: Node[] = []
        for (let i = 0; i < toc.points.length; i++) {
            const e = toc.points[i]
            const nextTocPage = i < toc.points.length - 1 ? toc.points[i + 1].spinePage : reader.spine.length
            o.push(<div className="link-button toc-point"
                onclick={() => this.LoadPage(e.spinePage)}
                tooltip={`Click to view\nPages ${e.spinePage + 1}-${nextTocPage}`}>
                {e.label}
            </div>)
        }
        replaceChildren(this.ToCBody, o)
    }

    override Dispose() {
        document.removeEventListener("keydown", this.DocumentKeydown)
    }

    async HandleDataTransfer(dt: DataTransfer | null) {
        if (dt === null) return
        const files = dt.files
        if (files.length === 0) {
            const uri = dt.getData("text/uri-list")
            // This doesn't end up working most of the time due to CORS
            if (uri && uri.startsWith("https://")) {
                return this.CacheAndLoadBlobLike(uri)
            }
            return
        }
        return this.CacheAndLoadBlobLike(files[0])
    }

    async CacheAndLoadBlobLike(blobLike: BlobLike) {
        const blob = await blobLikeToBlob(blobLike)
        const type = blob.type
        if (type === "application/epub+zip" || type === "text/html") {
            if (this.Cache) {
                const key = `https://jumprocks1.github.io/_/epub/recent`
                const response = new Response(blob, {
                    headers: {
                        "Content-Type": blob.type,
                        "Content-Length": blob.size.toString()
                    }
                })
                await this.Cache.put(key, response)
                await this.LoadEpubFileBlob(blob)
            }
        }
    }

    TooltipHandler?: JpHoverTooltipHandler
    DocumentKeydown = (ev: KeyboardEvent) => {
        if (disallowGlobalInput(ev)) return
        if (handleKeyDown(ev)) return

        const key = ev.key.toLowerCase()
        let handled = true
        if (key === ",") {
            OpenReaderSettings()
        } else if (key === "f") this.FuriganaButton.Click(undefined)
        else if (key === "t") this.JpdbLoadButton.Click(undefined)
        else if (key === "s") this.SaveParagraph()
        else if (key === "i") {
            if (this.TooltipHandler) {
                this.TooltipHandler.invert = !this.TooltipHandler.invert
                UpdateJpHover(false)
            }
        } else if (key === "arrowleft") {
            if (!this.Reader) return
            this.LoadPage(this.ProgressState.page - 1)
        } else if (key === "arrowright") {
            this.LoadPage(this.ProgressState.page + 1)
        } else if (key === "arrowdown") {
            this.NextParagraph(false)
        } else if (key === "arrowup") {
            this.NextParagraph(true)
        } else {
            handled = false
        }
        if (handled) ev.preventDefault()
    }

    SaveParagraph() {
        if (!this.Reader) return
        // This is a bit sketchy, but that's the fun part
        const target = document.querySelector(".epub-page p:hover")
        if (!target) return
        const index = (target as HTMLElement).paragraphIndex
        if (index !== undefined) {
            this.ProgressState.paragraphs[this.ProgressState.page] = index
            for (const p of this.CurrentPageNode.querySelectorAll("p"))
                p.classList.toggle("saved-position", p === target)
            this.SavePageState()
        }
    }

    // Stuff that doesn't really belong in the epub reader
    EnhancePageNode(node: EpubPage) {
        let i = 0;
        const paragraph = this.ProgressState.paragraphs[this.ProgressState.page] ?? 0
        for (const p of node.querySelectorAll("p")) {
            p.paragraphIndex = i
            p.appendChild(<div className="paragraph-index">{i + 1}</div>)
            if (i === paragraph) {
                p.classList.add("saved-position")
            }
            i += 1
        }
    }

    async ToggleFullscreen() {
        const fullscreen = this.FullscreenButton.textContent === "fullscreen"
        this.ViewerNode.classList.toggle("fullscreen", fullscreen)
        if (fullscreen) {
            // This doesn't work for some reason, might be Chrome extension bug
            // document.documentElement.requestFullscreen({ navigationUI: "hide" })
            this.FullscreenButton.textContent = "fullscreen_exit"
            this.FullscreenButton.tooltip = ActionTooltip("Exit Fullscreen")
        } else {
            this.FullscreenButton.textContent = "fullscreen"
            this.FullscreenButton.tooltip = ActionTooltip("Fullscreen")
        }
    }
}


function OpenReaderSettings() {
    const body = <Loader load={async () => {
        return <>
            {await JpdbApiKeyField()}
            <div className="field">
                <label>Furigana Mode</label>
                {Select({
                    defaultValue: await getSetting("furiganaMode"),
                    options: furiganaModes,
                    onChange: v => setSetting("furiganaMode", v as any)
                })}
            </div>
        </>
    }} />

    return OpenModal({
        header: "Reader Settings",
        body,
        id: "reader-settings-modal"
    })
}