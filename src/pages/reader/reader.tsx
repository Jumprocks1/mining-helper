import IconButton from "../../components/basic/IconButton"
import Loader from "../../components/Loader"
import { OpenModal } from "../../components/Modal"
import { EpubReader } from "../../epub/epub"
import { replaceChildren, replaceWith } from "../../framework/createElement"
import { PageComponent } from "../../framework/PageComponent"
import { ActionTooltip } from "../../framework/Tooltips"
import { disallowGlobalInput, handleKeyDown } from "../../utils/GlobalHotkeys"
import { JpdbApiKeyField } from "../../views/SettingsFields"

const currentPageKey = "reader-current-page"

export default class ReaderPage extends PageComponent {
    Id = "reader-page"
    override Title = "Mining Helper - Reader"
    override Node: HTMLElement

    CurrentPageNode: HTMLElement = <div>Drop .epub here</div>
    ViewerNode: HTMLElement = <div id="epub-viewer">
        {this.CurrentPageNode}
    </div>
    PageIndicator: HTMLElement = <div id="page-indicator" tooltip={() => this.PageTooltip()}>0 / 0</div>
    ToC: HTMLElement = <div id="toc" />
    Reader?: EpubReader

    constructor() {
        super()


        const body = <>
            <div id="status-info">
                <div className="row">
                    <IconButton icon="settings" onClick={() => OpenReaderSettings()} tooltip={ActionTooltip("Open Settings", ",")} />
                </div>
                <div className="row">
                    {this.PageIndicator}
                </div>
                <div className="row">
                    <IconButton onClick={async () => {
                        if (!this.Reader) return
                        await this.LoadPage(this.Reader.CurrentPage - 1)
                    }} icon="arrow_back" />
                    <IconButton onClick={async () => {
                        if (!this.Reader) return
                        this.LoadPage(this.Reader.CurrentPage + 1)
                    }} icon="arrow_forward" />
                </div>
                {/* TODO ToC gets squish on small screen */}
                {this.ToC}
            </div>
            {this.ViewerNode}
        </>
        this.Node = body


        document.addEventListener("keydown", this.DocumentKeydown)

        // TODO can share a lot of this with subtitles.tsx
        body.addEventListener("dragover", ev => {
            ev.preventDefault()
            if (ev.dataTransfer) ev.dataTransfer.dropEffect = "link"
        })
        body.addEventListener("drop", ev => {
            ev.preventDefault()
            return this.HandleDataTransfer(ev.dataTransfer)
        })
    }

    Cache?: Cache

    PageTooltip() {
        if (!this.Reader) return
        const currentPage = this.Reader.CurrentPage
        const spine = this.Reader.spine[currentPage]
        return spine.href
    }

    override Load = async () => {
        this.Cache = await caches.open("reader")
        const response = await this.Cache.match(`https://jumprocks1.github.io/_/epub/recent`)
        if (response) {
            this.LoadEpubFileBlob(await response.blob())
        }
    }

    SetPageNode(node: HTMLElement) {
        replaceWith(this.CurrentPageNode!, node)
        this.CurrentPageNode = node
    }

    async LoadEpubFileBlob(blob: Blob) {
        this.SetPageNode(<div className="loader" />)
        this.Reader = new EpubReader({ trimWhitespace: false })
        await this.Reader.read(blob)
        const recentPage = parseInt(localStorage.getItem(currentPageKey) ?? "")
        this.LoadToC()
        await this.LoadPage(isNaN(recentPage) ? 0 : recentPage)
    }

    async LoadPage(page: number) {
        if (!this.Reader) return
        const totalPages = this.Reader.spine.length
        page = Math.max(Math.min(page, totalPages - 1), 0)
        this.PageIndicator.textContent = `${page + 1} / ${totalPages}`
        localStorage.setItem(currentPageKey, page.toString())
        if (page !== this.Reader?.CurrentPage) this.SetPageNode(await this.Reader.readPage(page))
        this.ViewerNode.scrollTo({ top: 0 })
        const tocPoints = this.ToC.querySelectorAll(".toc-point")
        const toc = this.Reader.toc
        for (let i = 0; i < tocPoints.length; i++) {
            const e = toc.points[i]
            const nextTocPage = i < toc.points.length - 1 ? toc.points[i + 1].spinePage : this.Reader.spine.length
            tocPoints.item(i).classList.toggle("active", page >= e.spinePage && page < nextTocPage)
        }
    }

    LoadToC() {
        const reader = this.Reader
        if (!reader) return
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
        replaceChildren(this.ToC, o)
    }

    override Dispose() {
        document.removeEventListener("keydown", this.DocumentKeydown)
    }

    async HandleDataTransfer(dt: DataTransfer | null) {
        const files = dt?.files
        if (!files || files.length === 0) return
        const file = files[0]
        if (file.name.endsWith(".epub")) {
            if (this.Cache) {
                const key = `https://jumprocks1.github.io/_/epub/recent`
                const response = new Response(file, {
                    headers: {
                        "Content-Type": file.type,
                        "Content-Length": file.size.toString()
                    }
                })
                await this.Cache.put(key, response)
                await this.LoadEpubFileBlob(file)
            }
        }
    }

    DocumentKeydown = (ev: KeyboardEvent) => {
        if (disallowGlobalInput(ev)) return
        if (handleKeyDown(ev)) return

        const key = ev.key.toLowerCase()
        if (key === ",") {
            OpenReaderSettings()
        }
    }
}


function OpenReaderSettings() {
    const body = <Loader load={async () => {
        return <>
            {await JpdbApiKeyField()}
        </>
    }} />

    return OpenModal({
        header: "Reader Settings",
        body
    })
}