import IconButton from "../../components/basic/IconButton"
import Loader from "../../components/Loader"
import { OpenModal } from "../../components/Modal"
import { EpubReader } from "../../epub/epub"
import { replaceWith } from "../../framework/createElement"
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
    PageIndicator: HTMLElement = <div id="page-indicator">0 / 0</div>
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
            </div>
            <div id="epub-viewer">
                {this.CurrentPageNode}
            </div>
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

    override Load = async () => {
        this.Cache = await caches.open("reader")
        const response = await this.Cache.match(`https://jumprocks1.github.io/_/epub/recent`)
        if (response) {
            this.LoadBlob(await response.blob())
        }
    }

    SetPageNode(node: HTMLElement) {
        replaceWith(this.CurrentPageNode!, node)
        this.CurrentPageNode = node
    }

    async LoadBlob(blob: Blob) {
        this.SetPageNode(<div className="loader" />)
        this.Reader = new EpubReader({ trimWhitespace: false })
        await this.Reader.read(blob)
        const recentPage = parseInt(localStorage.getItem(currentPageKey) ?? "")
        this.Reader.CurrentPage = isNaN(recentPage) ? 0 : recentPage
        await this.LoadPage(this.Reader.CurrentPage)
    }

    // TODO need to support TOC somewhere (sidebar)

    async LoadPage(page: number) {
        if (!this.Reader) return
        const totalPages = this.Reader.spine.length
        if (page < 0 || page >= totalPages) return
        this.PageIndicator.textContent = `${page + 1} / ${totalPages}`
        localStorage.setItem(currentPageKey, page.toString())
        this.SetPageNode(await this.Reader.readPage(page))
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
                await this.LoadBlob(file)
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