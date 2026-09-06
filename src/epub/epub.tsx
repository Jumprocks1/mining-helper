import JSZip from 'jszip' // I'm not a fan of importing this directly. It doubles the bundle size...
import { JpdbParseResponse } from '../jpdb/JpdbParseText'

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

declare const brandSymbol: unique symbol
type Brand<T, Name extends string> = T & { readonly [brandSymbol]: Name }
export type EpubPage = Brand<HTMLDivElement, "epub-page"> & { jpdb?: JpdbParseResponse }

export class EpubReader {
    DOMParser: DOMParser = new DOMParser()
    _opfXML?: Document
    get opfXML() {
        if (!this._opfXML) throw new EpubReaderError("Missing OPF xml")
        return this._opfXML
    }
    settings: EpubSettings
    sanitizer: Sanitizer = new Sanitizer()
    constructor(settings?: EpubSettings) {
        this.settings = settings ?? {}
        this.setupSanitizer()
    }

    CurrentPage = -1

    manifest: Record<string, EpubItem> = {}
    spine: EpubItem[] = []
    toc: EpubToc = { points: [] }
    get zip() {
        if (!this._zip) throw new EpubReaderError("No zip archive loaded")
        return this._zip
    }
    _zip?: JSZip

    async read(blob: Blob) {
        if (blob.type !== "application/epub+zip") throw new EpubReaderError(`Expected epub, got ${blob.type}`)
        this._zip = new JSZip()
        await this.zip.loadAsync(blob)
        const container = await this.readXML("META-INF/container.xml")
        const rootFile = container.querySelector("container > rootfiles > rootfile")
        const opfPath = rootFile?.getAttribute("full-path")
        if (!opfPath) throw new EpubReaderError("Failed to find rootfile")
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
        if (toc.type !== "application/x-dtbncx+xml") throw new EpubReaderError(`Unexpected TOC type '${toc.type}'`)
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
        const file = this.zip.file(href)
        if (!file) throw new EpubReaderError(`Failed to open ${href}`)
        const containerText = await file.async("string")
        return this.DOMParser.parseFromString(containerText, xhtml ? "application/xhtml+xml" : "application/xml")
    }
    LiveBlobUrls: string[] = []
    ClearBlobUrls() {
        for (const url of this.LiveBlobUrls) URL.revokeObjectURL(url)
        this.LiveBlobUrls.length = 0
    }

    // We sanitize in here to avoid accidentally dumping directly into page
    async readPage(page: number) {
        // I think for images, we'll replace them with some sort of special node
        // after running those special nodes through the sanitizer, we'll replace them with images again
        const item = this.spine[page]
        if (!item) throw new EpubReaderError(`Page ${page} not found`)
        if (item.type !== "application/xhtml+xml") throw new EpubReaderError(`Expected xhtml, got ${item.type}`)
        this.ClearBlobUrls()
        const o = document.createElement("div")
        o.classList.add("epub-page")
        const file = await this.readXML(item.href, true)
        const htmlNode = file.querySelector("html")!

        if (this.settings.trimWhitespace) {
            const walker = file.createTreeWalker(htmlNode, NodeFilter.SHOW_TEXT);
            let node;
            while (node = walker.nextNode()) {
                if (node.nodeValue) node.nodeValue = node.nodeValue.trim()
            }
        }

        for (const e of htmlNode.querySelectorAll("svg[preserveAspectRatio=none]")) {
            e.removeAttribute("preserveAspectRatio")
        }

        const referenceElements = new Map<string, Node>()

        const images = htmlNode.querySelectorAll("img, image")
        for (const image of images) {
            const id = referenceElements.size.toString()
            referenceElements.set(id, image)
            const placeholder = image instanceof SVGElement ? file.createElementNS(svgNS, "g") : <div />
            placeholder.setAttribute("data-epub-ref-id", id)
            image.replaceWith(placeholder)
        }
        o.setHTML(htmlNode.getHTML(), { sanitizer: this.sanitizer })
        for (const el of o.querySelectorAll("*[data-epub-ref-id]")) {
            const refId = el.getAttribute("data-epub-ref-id")
            if (!refId) continue
            const oldEl = referenceElements.get(refId)
            if (!oldEl) continue
            if (oldEl instanceof HTMLImageElement) {
                const src = oldEl.getAttribute("src")
                if (!src) continue
                const url = new URL(src, "zip:/" + item.href).href.substring(5)
                const file = this.zip.file(url)
                if (file) {
                    const img = <img /> as HTMLImageElement
                    const url = URL.createObjectURL(await file.async("blob"))
                    this.LiveBlobUrls.push(url)
                    img.src = url
                    await img.decode()
                    el.replaceWith(img)
                }
            } else if (oldEl instanceof SVGImageElement) {
                const src = oldEl.getAttribute("href") ?? oldEl.getAttribute("xlink:href")
                if (!src) continue
                const url = new URL(src, "zip:/" + item.href).href.substring(5)
                const file = this.zip.file(url)
                if (file) {
                    const img = document.createElementNS(svgNS, "image");
                    // TODO couldn't get img.decode to work here
                    // MDN says it should work fine. I tried with src too
                    // https://developer.mozilla.org/en-US/docs/Web/API/SVGImageElement/decode
                    const url = URL.createObjectURL(await file.async("blob"))
                    this.LiveBlobUrls.push(url)
                    img.setAttribute("href", url)
                    img.setAttribute("width", oldEl.getAttribute("width")!)
                    img.setAttribute("height", oldEl.getAttribute("height")!)
                    el.replaceWith(img)
                }
            }
        }
        this.CurrentPage = page
        return o as EpubPage
    }
    setupSanitizer() {
        this.sanitizer.allowElement({ name: "div", attributes: ["data-epub-ref-id"] })
        this.sanitizer.allowElement({ name: "g", attributes: ["data-epub-ref-id"], namespace: svgNS })
        // TODO could support links with href but really doesn't feel worth it
        this.sanitizer.removeAttribute("href")
    }
}


class EpubReaderError extends Error { }