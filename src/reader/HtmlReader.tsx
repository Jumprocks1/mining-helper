import { BaseReader, EpubPage, ReaderError } from './BaseReader'


export class HtmlReader extends BaseReader {
    override get PageCount(): number {
        return 1
    }
    override async ReadPage(_: number): Promise<EpubPage> {
        if (!this.page) throw new ReaderError("Page not loaded")
        return this.page
    }

    page?: EpubPage

    constructor() {
        super()
        this.setupSanitizer()
    }

    DOMParser: DOMParser = new DOMParser()
    sanitizer: Sanitizer = new Sanitizer()

    async read(blob: Blob) {
        if (blob.type !== "text/html") throw new ReaderError(`Expected html, got ${blob.type}`)
        const o = document.createElement("div")
        o.classList.add("epub-page")
        const file = this.DOMParser.parseFromString(await blob.text(), blob.type)
        const bodyNode = await this.SelectPageBodyNode(file)
        o.setHTML(bodyNode.getHTML(), { sanitizer: this.sanitizer })
        this.page = o as EpubPage
    }
    setupSanitizer() {
        // TODO should eventually support these
        this.sanitizer.removeAttribute("href")
    }
}
