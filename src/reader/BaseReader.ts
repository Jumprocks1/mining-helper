import { type Brand } from "../framework/util";
import { type JpdbParseResponseWithNodes } from "./epubJpdb";

// TODO need to change this to generic name
export type EpubPage = Brand<HTMLDivElement, "epub-page"> & { jpdb?: JpdbParseResponseWithNodes }

export abstract class BaseReader {
    abstract get PageCount(): number
    abstract ReadPage(page: number): Promise<EpubPage>
}

export class ReaderError extends Error { }