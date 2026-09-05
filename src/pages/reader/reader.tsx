import Loader from "../../components/Loader"
import { EpubReader } from "../../epub/epub"
import { appendChild, replaceChildren } from "../../framework/createElement"
import { PageComponent } from "../../framework/PageComponent"
import { disallowGlobalInput, handleKeyDown } from "../../utils/GlobalHotkeys"

export default class ReaderPage extends PageComponent {
    Id = "reader-page"
    override Title = "Mining Helper - Reader"
    override Node: HTMLElement

    constructor() {
        super()


        const body = <div>
            Drop .epub here
        </div>
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

    async LoadBlob(blob: Blob) {
        replaceChildren(this.Node, <Loader load={async () => {
            const reader = new EpubReader({ trimWhitespace: false })
            const epub = await reader.read(blob)
            const page = await epub.readPage(11)
            return page
        }} />)
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
    }
}
