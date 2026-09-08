import { BaseReader } from "./BaseReader"
import { EpubReader } from "./EpubReader"
import { HtmlReader } from "./HtmlReader"

export default async function (blobLike: BlobLike): Promise<BaseReader> {
    const blob = await blobLikeToBlob(blobLike)
    if (blob.type === "application/epub+zip") {
        const reader = new EpubReader({ trimWhitespace: false })
        await reader.read(blob)
        return reader
    } else if (blob.type === "text/html") {
        const reader = new HtmlReader()
        await reader.read(blob)
        return reader
    }
    throw new Error(`No reader for ${blob.type}`)
}

export type BlobLike = Blob | string

export async function blobLikeToBlob(blob: BlobLike) {
    if (blob instanceof Blob) return blob
    if (typeof blob === "string" && blob.startsWith("https://")) {
        const resp = await fetch(blob)
        return resp.blob()
    }
    throw new Error("Failed to get blob")
}