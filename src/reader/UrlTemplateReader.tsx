import { BaseReader, ReaderPageNode } from './BaseReader'
import { Library, LibraryBook, urlToBlob } from './Library'


export class UrlTemplateReader extends BaseReader {
    override get PageCount(): number {
        return this.Book.pageCount ?? this.Page + 2 // we add 2 to make sure there's always another page after the current one
    }

    override get PageLimit() {
        return Infinity
    }

    override async ReadPage(page: number): Promise<ReaderPageNode> {
        let url = this.Book.key.toString()
        url = url.replaceAll("$page", (page + 1).toString())

        const tempBook: LibraryBook = { key: url, source: "url" }
        // note, this is different from other book caching
        const response = await this.Cache.match(url)
        if (response) tempBook.data = await response.blob()
        else {
            const blob = await urlToBlob(url)
            tempBook.data = blob
            if (blob.size < 100_000_000) {
                await this.Cache.put(url, new Response(blob, {
                    headers: {
                        "Content-Type": blob.type,
                        "Content-Length": blob.size.toString()
                    }
                }))
            }
        }
        tempBook.contentType = tempBook.data.type as LibraryBook["contentType"]
        this.Book.pageCount = Math.max(this.Book.pageCount ?? 0, page + 2)

        const library = await Library.Instance()
        const reader = await library.GetReaderForBook(tempBook)
        return reader.ReadPage(0)
    }

    Cache: Cache

    constructor(book: LibraryBook, cache: Cache) {
        super(book)
        this.Cache = cache
    }
}
