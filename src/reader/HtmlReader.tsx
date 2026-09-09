import { BaseReader, ReaderPageNode, ReaderError } from './BaseReader'
import { LibraryBook } from './Library'


export class HtmlReader extends BaseReader {
    override get PageCount(): number {
        return 1
    }
    override async ReadPage(_: number): Promise<ReaderPageNode> {
        if (!this.page) throw new ReaderError("Page not loaded")
        return this.page
    }

    page?: ReaderPageNode

    constructor(book: LibraryBook) {
        super(book)
        this.setupSanitizer()
    }

    DOMParser: DOMParser = new DOMParser()
    sanitizer: Sanitizer = new Sanitizer()

    async read(s: string, type: DOMParserSupportedType) {
        const o = document.createElement("div")
        o.classList.add("reader-page-node")
        const file = this.DOMParser.parseFromString(s, type)
        const bodyNode = await this.SelectPageBodyNode(file)
        o.setHTML(bodyNode.getHTML(), { sanitizer: this.sanitizer })
        this.page = o as ReaderPageNode
    }
    setupSanitizer() {
        // TODO should eventually support these
        this.sanitizer.removeAttribute("href")
    }
}
