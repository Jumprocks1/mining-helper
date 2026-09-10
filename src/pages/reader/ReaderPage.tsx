import IconButton, { IconButtonClass } from "../../components/basic/IconButton"
import Loader from "../../components/Loader"
import { OpenModal } from "../../components/Modal"
import Select from "../../components/Select"
import { furiganaModes, getSetting, getSettingSync, setSetting } from "../../core/Settings"
import { EpubReader } from "../../reader/EpubReader"
import readerPageJpdb from "../../reader/readerPageJpdb"
import { replaceChildren, replaceWith } from "../../framework/createElement"
import { PageComponent } from "../../framework/PageComponent"
import { ActionTooltip } from "../../framework/Tooltips"
import { JpdbToken } from "../../jpdb/JpdbParseText"
import { disallowGlobalInput, handleKeyDown } from "../../utils/GlobalHotkeys"
import { JpdbApiKeyField } from "../../views/SettingsFields"
import { getAnkiFurigana } from "../anki/CardList"
import { HoverRectangleContainer, JpHoverTooltipHandler, RegisterJpHoverTooltip, UpdateHoverBox, UpdateJpHover } from "../subtitles/JpHoverTooltip"
import { AddFurigana } from "./furigana"
import { BaseReader, ReaderPageNode } from "../../reader/BaseReader"
import { stringSettingsField } from "../../views/SettingsModal"
import AdvancedSettingsModal from "../../views/AdvancedSettingsModal"
import { Library, LibraryBook } from "../../reader/Library"
import LibraryModal from "./LibraryModal"
import { VocabState } from "../../jpdb/JpdbState"

const currentPositionKey = "reader-progress"

export default class ReaderPage extends PageComponent {
    Id = "reader-page"
    override Title = "Mining Helper - Reader"
    override Node: HTMLElement

    CurrentPageNode: ReaderPageNode = <div>Drop .epub here</div> as ReaderPageNode
    HoverRectangleContainer = HoverRectangleContainer()
    PageWrapper = <div id="reader-page-node-wrapper">
        {this.CurrentPageNode}
        {this.HoverRectangleContainer}
    </div>
    ViewerNode: HTMLElement = <div id="reader-page-viewer">{this.PageWrapper}</div>
    PageIndicator: HTMLElement = <div id="page-indicator" onclick={() => this.JumpToPage()} className="clickable" tooltip={() => this.PageTooltip()}>0 / 0</div>
    PageIndicatorWrapper: HTMLElement = <div id="page-indicator-wrapper">{this.PageIndicator}</div>
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
            await readerPageJpdb(this.CurrentPageNode)
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
                    <IconButton icon="local_library" onClick={() => LibraryModal()} tooltip={ActionTooltip("View Library")} />
                    <IconButton icon="settings" onClick={() => OpenReaderSettings()} tooltip={ActionTooltip("Open Settings", ",")} />
                </div>
                <div className="row">
                    {this.PageIndicatorWrapper}
                </div>
                <div className="row">
                    <IconButton onClick={async () => {
                        if (!this.Reader) return
                        await this.LoadPage(this.Reader.Page - 1)
                    }} icon="arrow_back" tooltip={ActionTooltip("Previous Page", "←")} />
                    <IconButton onClick={async () => {
                        if (!this.Reader) return
                        await this.LoadPage(this.Reader.Page + 1)
                    }} icon="arrow_forward" tooltip={ActionTooltip("Next Page", "→")} />
                </div>
            </div>
            {this.ToC}
            {this.ViewerNode}
        </>
        this.Node = body

        let hoverParagraph: HTMLElement | undefined
        let hoverElement: HTMLElement | undefined
        const setHoverState = (p: HTMLElement | undefined) => {
            if (hoverParagraph === p) return
            hoverParagraph = p
            if (!p) {
                hoverElement?.remove()
                return
            }
            if (hoverElement === undefined) {
                const bookmarkButton = <IconButton icon="bookmark" tooltip={ActionTooltip("Bookmark", "S")}
                    onClick={async () => {
                        const index = hoverParagraph?.paragraphIndex
                        if (index === undefined) return
                        await this.BookmarkParagraph(index)
                    }} />
                bookmarkButton.tooltipConfig = { delay: 500 } // this one is really annoying without a delay
                hoverElement = <div id="paragraph-buttons">
                    {bookmarkButton}
                </div>
            }
            p.append(hoverElement)
        }
        this.ViewerNode.addEventListener("mousemove", ev => {
            const target = ev.target
            if (!target || !(target instanceof HTMLElement)) return
            if (hoverElement?.contains(target)) return
            const p = target.closest<HTMLElement>(".reader-page-node p")
            if (!p) {
                setHoverState(undefined)
                return
            }
            const style = window.getComputedStyle(target)
            const x = p.getBoundingClientRect().x
            const pLeft = parseFloat(style.paddingLeft)
            if (ev.clientX > x + pLeft) setHoverState(undefined)
            else setHoverState(p)
        })
        getAnkiFurigana()
    }

    PageTooltip() {
        if (!this.Reader) return
        if (this.Reader.PageCount === 1) return "Pagination unavailable"
        let description: string | undefined
        if (this.Reader instanceof EpubReader) {
            description = this.Reader.spine[this.Reader.Page].href
        }
        return ActionTooltip("Click to jump", undefined, description)
    }

    Library: Library = undefined!

    override Load = async () => {
        this.Library = await Library.Instance()
        if (this.Library.lastBook) {
            const book = await this.Library.LoadBook(this.Library.lastBook)
            if (book && book.data) {
                await this.LoadBook(book)
            }
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
            onChange: state => {
                const vocabState = UpdateHoverBox(this.HoverRectangleContainer, state)
                if (state && vocabState !== undefined) {
                    if (getSettingSync("showUnknownVocabOnHover") && vocabState === VocabState.New) {
                        this.TooltipHandler?.forceSetHoverState?.({ ...state, tooltip: true })
                    }
                }
            }
        })

        document.addEventListener("keydown", this.DocumentKeydown)
        document.addEventListener("paste", this.DocumentPaste)

        // TODO can share a lot of this with subtitles.tsx
        this.ViewerNode.addEventListener("dragover", ev => {
            ev.preventDefault()
            if (ev.dataTransfer) ev.dataTransfer.dropEffect = "link"
        })
        this.ViewerNode.addEventListener("drop", async ev => {
            ev.preventDefault()
            const book = await this.Library.BookFromDataTransfer(ev.dataTransfer)
            if (!book) return
            return this.LoadBook(book)
        })
    }

    async LoadBook(book: LibraryBook) {
        if (book === undefined) return
        // TODO would be good to use an actual Loader call here - this would give support for error handling on page load
        // Might be weird if it's nested within an outer loader on inital page load though
        const node = <div className="loader" /> as ReaderPageNode
        replaceWith(this.CurrentPageNode!, node)
        this.CurrentPageNode = node
        this.Reader = await this.Library.OpenBook(book)
        this.LoadToC()
        await this.LoadPage(book.progress?.page ?? 0, true)
    }

    async LoadPage(page: number, initial: boolean = false) {
        if (!this.Reader) return
        const limit = this.Reader.PageLimit
        page = Math.max(Math.min(page, limit - 1), 0)
        if (page === this.Reader.ProgressState.page && !initial) return
        this.JpdbLoadButton.Disabled = true
        this.FuriganaButton.Disabled = true
        this.PageIndicator.textContent = `${page + 1} / ${this.Reader.PageCount}`
        if (this.Reader.ProgressState.page !== page) {
            this.Reader.ProgressState.page = page
            await this.Library.Save()
        }
        const pageNode = await this.Reader.ReadPage(page)
        this.PageIndicator.textContent = `${page + 1} / ${this.Reader.PageCount}` // for url-template this can update after ReadPage is called
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
        const paragraph = this.Reader.Paragraph
        if (paragraph === 0) {
            this.ViewerNode.scrollTo({ top: 0 })
        } else {
            this.OnAfterLoad(() => pageNode.querySelector("p.saved-position")?.scrollIntoView({ block: "center" }))
        }
        await readerPageJpdb(pageNode, true)
        this.JpdbLoadButton.Disabled = Boolean(pageNode.jpdb)
        this.FuriganaButton.Disabled = false
    }

    async NextParagraph(invert: boolean) {
        if (!this.Reader) return
        const oldParagraph = this.Reader.Paragraph
        const newParagraph = oldParagraph + (invert ? -1 : 1)
        const totalParagraphs = this.CurrentPageNode.querySelectorAll("p")
        if (newParagraph < 0)
            return this.LoadPage(this.Reader.Page - 1)
        if (newParagraph >= totalParagraphs.length)
            return this.LoadPage(this.Reader.Page + 1)
        this.Reader.ProgressState.paragraphs[this.Reader.Page] = newParagraph
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
        await this.Library.Save() // TODO this is also called inside LoadPage
    }

    LoadToC() {
        const reader = this.Reader
        if (!reader) return
        const o: Node[] = []
        if (reader instanceof EpubReader) {
            const toc = reader.toc
            for (let i = 0; i < toc.points.length; i++) {
                const e = toc.points[i]
                const nextTocPage = i < toc.points.length - 1 ? toc.points[i + 1].spinePage : reader.spine.length
                o.push(<div className="link-button toc-point"
                    onclick={() => this.LoadPage(e.spinePage)}
                    tooltip={`Click to view\nPages ${e.spinePage + 1}-${nextTocPage}`}>
                    {e.label}
                </div>)
            }
        }
        replaceChildren(this.ToCBody, o)
    }

    override Dispose() {
        document.removeEventListener("keydown", this.DocumentKeydown)
        document.removeEventListener("paste", this.DocumentPaste)
    }

    TooltipHandler?: JpHoverTooltipHandler
    DocumentKeydown = (ev: KeyboardEvent) => {
        if (disallowGlobalInput(ev)) return
        if (handleKeyDown(ev)) return

        if (ev.ctrlKey || ev.shiftKey || ev.altKey || ev.metaKey) return

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
            this.LoadPage(this.Reader.Page - 1)
        } else if (key === "arrowright") {
            if (!this.Reader) return
            this.LoadPage(this.Reader.Page + 1)
        } else if (key === "arrowdown") {
            this.NextParagraph(false)
        } else if (key === "arrowup") {
            this.NextParagraph(true)
        } else {
            handled = false
        }
        if (handled) ev.preventDefault()
    }
    DocumentPaste = async (ev: ClipboardEvent) => {
        function isEditable(el: HTMLElement) {
            return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el.isContentEditable
        }
        if (isEditable(ev.target as HTMLElement)) return
        ev.preventDefault()
        const book = await this.Library.BookFromDataTransfer(ev.clipboardData)
        if (!book) return
        return this.LoadBook(book)
    }

    async SaveParagraph() {
        if (!this.Reader) return
        // This is a bit sketchy, but that's the fun part
        const target = document.querySelector(".reader-page-node p:hover")
        if (!target) return
        const index = (target as HTMLElement).paragraphIndex
        if (index !== undefined) await this.BookmarkParagraph(index)
    }

    async BookmarkParagraph(index: number) {
        if (!this.Reader) return
        this.Reader.ProgressState.paragraphs[this.Reader.Page] = index
        for (const p of this.CurrentPageNode.querySelectorAll("p"))
            p.classList.toggle("saved-position", p.paragraphIndex === index)
        await this.Library.Save()
    }

    // Stuff that doesn't really belong in the Reader classes
    EnhancePageNode(node: ReaderPageNode) {
        if (!this.Reader) return
        let i = 0;
        const paragraph = this.Reader.Paragraph ?? 0
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

    JumpToPage() {
        let committed = false
        const commit = () => {
            if (committed) return
            committed = true
            this.PageIndicatorWrapper.replaceChildren(this.PageIndicator)
            const value = Math.floor(parseInt(input.value)) - 1
            if (isFinite(value)) this.LoadPage(value)
        }
        const input = <input type="string" defaultValue={((this.Reader?.Page ?? 0) + 1).toString()}
            onblur={commit} onkeydown={ev => { if (ev.key === "Enter") commit() }} /> as HTMLInputElement
        this.PageIndicatorWrapper.replaceChildren(input)
        input.focus()
        input.select()
    }
}


function OpenReaderSettings() {
    const body = <Loader load={async () => {
        return <>
            {await JpdbApiKeyField()}
            {await stringSettingsField("readerBodySelector", "Body Selector", undefined,
                <div>CSS selector for filtering what content is displayed in the reader.{"\n"}
                    Separate multiple selectors with <em>;</em>. Earlier selectors are prioritized.{"\n\n"}
                    Ex: <em>main article; main</em>
                </div>)}
            <div className="field">
                <label>Furigana Mode</label>
                {Select({
                    defaultValue: await getSetting("furiganaMode"),
                    options: furiganaModes,
                    onChange: v => setSetting("furiganaMode", v as any)
                })}
            </div>
            <div className="field">
                <label>Unknown Vocab On Hover</label>
                {Select({
                    defaultValue: (await getSetting("showUnknownVocabOnHover") ? "true" : "false"),
                    options: [["false", "Same as other vocab"], ["true", "Always show tooltip"]],
                    onChange: v => setSetting("showUnknownVocabOnHover", v === "true")
                })}
            </div>
        </>
    }} />

    const modal = OpenModal({
        header: "Reader Settings",
        body,
        id: "reader-settings-modal",
        footer: <button onclick={() => {
            modal.Close()
            AdvancedSettingsModal()
        }}>
            Advanced Settings
        </button>
    })
    return modal
}