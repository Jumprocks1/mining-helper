import { BlobReader, BlobWriter, type FileEntry, TextWriter, ZipReader } from '@zip.js/zip.js/lib/zip-core.js'
import { BaseReader, EpubPage, ReaderError } from './BaseReader'

interface EpubItem {
    href: string
    type: string
}
interface EpubToc {
    points: {
        id: string
        type?: string
        order?: number
        label: string
        href: string
        spinePage: number
    }[]
}

interface EpubSettings {
    trimWhitespace?: boolean
}
const svgNS = "http://www.w3.org/2000/svg"

export class EpubReader extends BaseReader {
    DOMParser: DOMParser = new DOMParser()
    _opfXML?: Document
    get opfXML() {
        if (!this._opfXML) throw new ReaderError("Missing OPF xml")
        return this._opfXML
    }
    settings: EpubSettings
    sanitizer: Sanitizer = new Sanitizer()
    constructor(settings?: EpubSettings) {
        super()
        this.settings = settings ?? {}
        this.setupSanitizer()
    }

    manifest: Record<string, EpubItem> = {}
    spine: EpubItem[] = []
    toc: EpubToc = { points: [] }
    get zip() {
        if (!this._zip) throw new ReaderError("No zip archive loaded")
        return this._zip
    }
    _zip?: Record<string, FileEntry>

    async read(blob: Blob) {
        if (blob.type !== "application/epub+zip") throw new ReaderError(`Expected epub, got ${blob.type}`)
        const reader = new ZipReader(new BlobReader(blob))
        this._zip = {}
        for (const entry of await reader.getEntries()) {
            if (!entry.directory) this._zip[entry.filename] = entry
        }
        const container = await this.readXML("META-INF/container.xml")
        const rootFile = container.querySelector("container > rootfiles > rootfile")
        const opfPath = rootFile?.getAttribute("full-path")
        if (!opfPath) throw new ReaderError("Failed to find rootfile")
        this._opfXML = await this.readXML(opfPath)
        this.loadManifest()
        await this.loadSpine()
        return this
    }

    loadManifest() {
        this.manifest = {}
        const nodes = this.opfXML.querySelectorAll("package > manifest > item")
        for (const node of nodes) {
            const href = node.getAttribute("href")
            const type = node.getAttribute("media-type")
            if (href && type)
                this.manifest[node.id] = { href, type }
        }
    }
    async loadSpine() {
        this.spine = []
        const spine = this.opfXML.querySelector("package > spine")
        if (!spine) return
        const nodes = spine.querySelectorAll(":scope > itemref")
        for (const node of nodes) {
            const idref = node.getAttribute("idref")
            if (idref) {
                const item = this.manifest[idref]
                if (item) this.spine.push(item)
            }
        }
        const tocId = spine.getAttribute("toc")
        if (tocId) {
            const toc = this.manifest[tocId]
            if (toc) await this.loadToc(toc)
        }
    }

    async loadToc(toc: EpubItem) {
        if (toc.type !== "application/x-dtbncx+xml") throw new ReaderError(`Unexpected TOC type '${toc.type}'`)
        this.toc = { points: [] }
        const xml = await this.readXML(toc.href)
        const navPoints = xml.querySelectorAll("ncx > navMap > navPoint")
        for (const navPoint of navPoints) {
            const label = navPoint.querySelector("navLabel")!.textContent.trim()
            let href = navPoint.querySelector("content")!.getAttribute("src")!
            const spl = href.split("#")
            href = spl[0]
            const playOrder = navPoint.getAttribute("playOrder")
            this.toc.points.push({
                label,
                href,
                id: navPoint.id,
                order: playOrder ? parseInt(playOrder) : undefined,
                type: navPoint.className,
                spinePage: this.spine.findIndex(e => e.href === href)
            })
        }
        this.toc.points.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }

    async readXML(href: string, xhtml = false) {
        const file = this.zip[href]
        if (!file) throw new ReaderError(`Failed to open ${href}`)
        const containerText = await file.getData(new TextWriter())
        return this.DOMParser.parseFromString(containerText, xhtml ? "application/xhtml+xml" : "application/xml")
    }
    LiveBlobUrls: string[] = []
    ClearBlobUrls() {
        for (const url of this.LiveBlobUrls) URL.revokeObjectURL(url)
        this.LiveBlobUrls.length = 0
    }

    // We sanitize in here to avoid accidentally dumping directly into page
    override async ReadPage(page: number) {
        const item = this.spine[page]
        if (!item) throw new ReaderError(`Page ${page} not found`)
        if (item.type !== "application/xhtml+xml") throw new ReaderError(`Expected xhtml, got ${item.type}`)
        this.ClearBlobUrls()
        const o = document.createElement("div")
        o.classList.add("epub-page")
        const file = await this.readXML(item.href, true)
        const bodyNode = await this.SelectPageBodyNode(file)

        if (this.settings.trimWhitespace) {
            const walker = file.createTreeWalker(bodyNode, NodeFilter.SHOW_TEXT);
            let node;
            while (node = walker.nextNode()) {
                if (node.nodeValue) node.nodeValue = node.nodeValue.trim()
            }
        }

        for (const e of bodyNode.querySelectorAll("svg[preserveAspectRatio=none]")) {
            e.removeAttribute("preserveAspectRatio")
        }

        const referenceElements = new Map<string, Node>()

        const images = bodyNode.querySelectorAll("img, image")
        for (const image of images) {
            const id = referenceElements.size.toString()
            referenceElements.set(id, image)
            const placeholder = image instanceof SVGElement ? file.createElementNS(svgNS, "g") : <div />
            placeholder.setAttribute("data-epub-ref-id", id)
            image.replaceWith(placeholder)
        }
        o.setHTML(bodyNode.getHTML(), { sanitizer: this.sanitizer })
        for (const el of o.querySelectorAll("*[data-epub-ref-id]")) {
            const refId = el.getAttribute("data-epub-ref-id")
            if (!refId) continue
            const oldEl = referenceElements.get(refId)
            if (!oldEl) continue
            if (oldEl instanceof HTMLImageElement) {
                const src = oldEl.getAttribute("src")
                if (!src) continue
                const url = new URL(src, "zip:/" + item.href).href.substring(5)
                const file = this.zip[url]
                if (file) {
                    const img = <img /> as HTMLImageElement
                    const url = URL.createObjectURL(await file.getData(new BlobWriter()))
                    this.LiveBlobUrls.push(url)
                    img.src = url
                    await img.decode()
                    el.replaceWith(img)
                }
            } else if (oldEl instanceof SVGImageElement) {
                const src = oldEl.getAttribute("href") ?? oldEl.getAttribute("xlink:href")
                if (!src) continue
                const url = new URL(src, "zip:/" + item.href).href.substring(5)
                const file = this.zip[url]
                if (file) {
                    const img = document.createElementNS(svgNS, "image");
                    // TODO couldn't get img.decode to work here
                    // MDN says it should work fine. I tried with src too
                    // https://developer.mozilla.org/en-US/docs/Web/API/SVGImageElement/decode
                    const url = URL.createObjectURL(await file.getData(new BlobWriter()))
                    this.LiveBlobUrls.push(url)
                    img.setAttribute("href", url)
                    img.setAttribute("width", oldEl.getAttribute("width")!)
                    img.setAttribute("height", oldEl.getAttribute("height")!)
                    el.replaceWith(img)
                }
            }
        }
        return o as EpubPage
    }
    setupSanitizer() {
        this.sanitizer.allowElement({ name: "div", attributes: ["data-epub-ref-id"] })
        this.sanitizer.allowElement({ name: "g", attributes: ["data-epub-ref-id"], namespace: svgNS })
        // TODO could support links with href but really doesn't feel worth it
        this.sanitizer.removeAttribute("href")
    }
    override get PageCount(): number {
        return this.spine.length
    }
}