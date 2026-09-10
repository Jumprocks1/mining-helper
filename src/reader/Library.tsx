import { BrowserStorage } from "../utils/BrowserApi"
import { BaseReader } from "./BaseReader"
import { EpubReader } from "./EpubReader"
import { HtmlReader } from "./HtmlReader"
import { UrlTemplateReader } from "./UrlTemplateReader"

// this gets serialized, don't include any blobs here
interface LibraryData {
    books?: LibraryBook[]
    lastBook?: BookKey
}

interface LibraryBookBase {
    // Most of this should be "throwaway" other than progress
    key: BookKey
    source: "url" | "file" | "clipboard" | "url-template"
    name?: string
    data?: string | Blob
    cacheKey?: string
    contentType?: "application/epub+zip" | "text/html" | "text/plain"
    pageCount?: number

    progress?: BookProgress
}

export type LibraryBook = LibraryBookBase

// Will eventually add more stuff to this like notes
// "Progress" will just mean persistent data that the user wouldn't want to lose
interface BookProgress {
    page: number
    paragraphs: Record<number, number | undefined> // map of page => paragraph progress
}

type BookKey = string | number

let library: Library | undefined = undefined
let loading: Promise<Library> | undefined

export class Library {
    books: LibraryBook[]
    lastBook?: BookKey = undefined

    Cache: Cache
    CurrentBook?: LibraryBook
    get CurrentProgress() {
        return this.CurrentBook?.progress
    }

    private constructor(books: LibraryBook[], cache: Cache) {
        this.books = books
        this.Cache = cache
    }

    static Instance() {
        return library || (loading ??= this._load())
    }
    private static async _load(): Promise<Library> {
        const data: LibraryData = (await BrowserStorage.local.get({ libraryData: {} })).libraryData
        const o = new Library(data.books ?? [], await caches.open("library"))
        o.lastBook = data.lastBook
        loading = undefined
        library = o
        return o
    }

    async LoadBook(key: BookKey): Promise<LibraryBook | undefined> {
        const book = this.books!.find(e => e.key === key)
        if (!book) return
        await this.TryLoadDataFromCache(book)
        return book
    }

    async TryLoadDataFromCache(book: LibraryBook) {
        if (book.data || !book.cacheKey) return
        const response = await this.Cache.match(book.cacheKey)
        if (response) book.data = await response.blob()
    }

    // Bit unfortnate that we're calling this for the entire library when there's updates to single paragraph
    // In the future I think we'd either split the data per book (messy) or start using IndexedDB
    async Save() {
        const books = this.books!
        const data = books.map(e => e.data)
        this.books.forEach(e => delete e.data)
        const libraryData: LibraryData = { books, lastBook: this.lastBook }
        await BrowserStorage.local.set({ libraryData })
        this.books.forEach((e, i) => e.data = data[i])
    }

    // This will result in loading + saving each book's blob in RAM
    // think we want a close book that free's the blobs
    async OpenBook(book: LibraryBook) {
        if (!book.data && book.cacheKey) {
            const response = await this.Cache.match(book.cacheKey)
            if (response) book.data = await response.blob()
            else delete book.cacheKey // make sure we remember there's no cache
        }
        if (!book.data) {
            if (book.source === "url" && typeof book.key === "string") {
                book.data = await urlToBlob(book.key)
                book.contentType = book.data.type as LibraryBook["contentType"]
            }
            if (book.source === "url-template") {
                // These don't really need any meaningful data for now
                book.data = "{}"
            }
        }
        if (!book.cacheKey) {
            const blob = getBlob(book)
            if (blob.size < 100_000_000) {
                book.cacheKey = `https://jumprocks1.github.io/_/reader/blob/${await getBlobHash(blob)}`
                const response = new Response(blob, {
                    headers: {
                        "Content-Type": blob.type,
                        "Content-Length": blob.size.toString()
                    }
                })
                await this.Cache.put(book.cacheKey, response)
            }
        }
        let found = false
        for (let i = 0; i < this.books.length; i++) {
            if (this.books[i].key === book.key) {
                found = true
                book.progress ??= this.books[i].progress
                this.books[i] = book
            }
        }
        if (!found) this.books.push(book)
        this.lastBook = book.key
        this.CurrentBook = book
        const reader = await this.GetReaderForBook(book)
        book.pageCount = reader.PageCount
        await this.Save() // save cache related updates
        return reader
    }

    async RemoveBook(book: LibraryBook) {
        for (let i = this.books.length - 1; i >= 0; i--) {
            if (this.books[i].key === book.key)
                this.books.splice(i, 1)
        }
        const keys = new Set((await this.Cache.keys()).map(e => e.url))
        for (const book of this.books) {
            if (book.cacheKey) keys.delete(book.cacheKey)
            if (book.source === "url-template") {
                const key = book.key.toString()
                const replaceIndex = key.indexOf("$page")
                if (replaceIndex !== -1) {
                    const s = key.substring(0, replaceIndex)
                    const d: string[] = []
                    for (const e of keys) if (e.startsWith(s)) d.push(e)
                    for (const e of d) keys.delete(e)
                }
            }
        }
        for (const e of keys) this.Cache.delete(e)
        this.Save()
    }

    async GetReaderForBook(book: LibraryBook): Promise<BaseReader> {
        if (!book.data) throw new Error("Book missing data")
        if (book.source === "url-template") {
            return new UrlTemplateReader(book, this.Cache)
        } else if (book.contentType === "application/epub+zip") {
            const reader = new EpubReader(book, { trimWhitespace: false })
            await reader.read(getBlob(book))
            return reader
        } else if (book.contentType === "text/html") {
            const reader = new HtmlReader(book)
            await reader.read(await getString(book), book.contentType)
            return reader
        } else if (book.contentType === "text/plain") {
            const d = document.implementation.createHTMLDocument()
            const lines = (await getString(book)).split("\n")
            for (const l of lines) {
                const e = d.createElement("p")
                e.textContent = l
                d.body.append(e)
            }
            const reader = new HtmlReader(book)
            await reader.read(d.documentElement.getHTML(), "text/html")
            return reader
        }
        throw new Error(`No reader for ${book.contentType}`)
    }

    async BookFromDataTransfer(dt: DataTransfer | null): Promise<LibraryBook | undefined> {
        if (dt === null) return
        const files = dt.files
        if (files.length === 0) {
            const uri = dt.getData("text/uri-list")
            if (uri) {
                if (uri.startsWith("https://")) return { key: uri, source: "url" }
            }
            const html = dt.getData("text/html")
            if (html) return { key: await getStringHash(html), source: "clipboard", contentType: "text/html", data: html }
            const text = dt.getData("text/plain")
            if (text) {
                if (text.startsWith("https://")) return { key: text, source: "url" }
                return { key: await getStringHash(text), data: text, source: "clipboard", contentType: "text/plain" }
            }
        }
        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const type = file.type
            if (type === "application/epub+zip" || type === "text/html" || type === "text/plain") {
                return { key: file.name, source: "file", data: file, contentType: type }
            }
        }
    }
}

function getBlob(book: LibraryBook) {
    if (!book.data) throw new Error("Book missing data")
    if (book.data instanceof Blob) return book.data
    return new Blob([book.data], { type: book.contentType })
}
async function getString(book: LibraryBook) {
    if (!book.data) throw new Error("Book missing data")
    if (book.data instanceof Blob) return book.data.text()
    return book.data
}

export async function urlToBlob(url: string) {
    const u = new URL(url)
    if (typeof browser !== "undefined") {
        if (u.origin) {
            const req = { origins: [u.origin + "/*"] }
            const hasPerms = await browser.permissions.contains(req)
            if (!hasPerms) await browser.permissions.request(req)
        }
    }
    const resp = await fetch(u)
    return resp.blob()
}

export async function getStringHash(s: string): Promise<string> {
    const enc = new TextEncoder()
    const hashBuffer = await crypto.subtle.digest("SHA-256", enc.encode(s))
    // @ts-expect-error toHex was added in 2025
    return new Uint8Array(hashBuffer).toHex()
}
async function getBlobHash(blob: Blob): Promise<string> {
    const hashBuffer = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())
    // @ts-expect-error toHex was added in 2025
    return new Uint8Array(hashBuffer).toHex()
}