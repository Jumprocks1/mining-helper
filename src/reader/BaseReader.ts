import { getSetting } from "../core/Settings";
import { type Brand } from "../framework/util";
import { type JpdbParseResponseWithNodes } from "./epubJpdb";

// TODO need to change this to generic name
export type EpubPage = Brand<HTMLDivElement, "epub-page"> & { jpdb?: JpdbParseResponseWithNodes }

export abstract class BaseReader {
    abstract get PageCount(): number
    abstract ReadPage(page: number): Promise<EpubPage>

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