import { BaseReader } from "./BaseReader"
import { EpubReader } from "./EpubReader"
import { HtmlReader } from "./HtmlReader"

export default async function readBlob(blobLike: BlobLike): Promise<BaseReader> {
    const blob = await blobLikeToBlob(blobLike)
    if (blob.type === "application/epub+zip") {
        const reader = new EpubReader({ trimWhitespace: false })
        await reader.read(blob)
        return reader
    } else if (blob.type === "text/html") {
        const reader = new HtmlReader()
        await reader.read(blob)
        return reader
    } else if (blob.type === "text/plain") {
        const d = document.implementation.createHTMLDocument()
        const lines = (await blob.text()).split("\n")
        for (const l of lines) {
            const e = d.createElement("p")
            e.textContent = l
            d.body.append(e)
        }
        return readBlob(new Blob([d.documentElement.getHTML()], { type: "text/html" }))
    }
    throw new Error(`No reader for ${blob.type}`)
}

export type BlobLike = Blob | string

export async function blobLikeToBlob(blob: BlobLike) {
    if (blob instanceof Blob) return blob
    if (typeof blob === "string" && blob.startsWith("https://")) {
        const url = new URL(blob)
        if (typeof browser !== "undefined") {
            if (url.origin) {
                const req = { origins: [url.origin + "/*"] }
                const hasPerms = await browser.permissions.contains(req)
                if (!hasPerms) await browser.permissions.request(req)
            }
        }
        const resp = await fetch(url)
        return resp.blob()
    }
    throw new Error("Failed to get blob")
}