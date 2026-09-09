import { getSetting } from "../core/Settings";
import { type Brand } from "../framework/util";
import { LibraryBook } from "./Library";
import { type JpdbParseResponseWithNodes } from "./readerPageJpdb";

export type ReaderPageNode = Brand<HTMLDivElement, "reader-page-node"> & { jpdb?: JpdbParseResponseWithNodes }

export abstract class BaseReader {
    abstract get PageCount(): number
    abstract ReadPage(page: number): Promise<ReaderPageNode>

    Book: LibraryBook
    constructor(book: LibraryBook) {
        this.Book = book
    }
    get ProgressState() {
        return this.Book.progress ??= { page: 0, paragraphs: {} }
    }
    get Page() {
        return this.Book.progress?.page ?? 0
    }
    get Paragraph() {
        if (this.Book.progress)
            return this.Book.progress.paragraphs[this.Book.progress.page] ?? 0
        return 0
    }

    async SelectPageBodyNode(document: Document) {
        try {
            const selectors = await getSetting("readerBodySelector")
            for (const e of selectors.split(";")) {
                const match = document.querySelector(e.trim())
                if (match && match instanceof HTMLElement) {
                    return match
                }
            }
        } catch (e) {
            console.error(e, "Failed to find body node")
        }
        return document.documentElement
    }
}

export class ReaderError extends Error { }