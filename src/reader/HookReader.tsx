import { BaseReader, ReaderPageNode } from './BaseReader'
import { LibraryBook } from './Library'

interface HookMessage {
    name?: string
    text: string
}

interface HookData {
    messages: HookMessage[]
}

export class HookReader extends BaseReader {
    override get PageCount(): number {
        return 1
    }

    MessageToParagraph(message: HookMessage) {
        const paragraph = <p />
        if (message.name) paragraph.append(<span className="hook-message-name">{message.name}</span>)
        paragraph.append(message.text)
        return paragraph
    }
    override async ReadPage(_: number): Promise<ReaderPageNode> {
        if (this.page) return this.page

        const page = <div className="reader-page-node" /> as ReaderPageNode
        this.page = page
        let tempData: Partial<HookData> = {}
        if (typeof this.Book.data === "string") {
            try { tempData = JSON.parse(this.Book.data) } catch { }
        } else if (this.Book.data instanceof Blob) {
            try { tempData = JSON.parse(await this.Book.data.text()) } catch { }
        }
        tempData.messages ??= []
        const parsedData = tempData as HookData
        for (const message of parsedData.messages) page.append(this.MessageToParagraph(message))

        const onMessage = (message: any) => {
            // TODO this still probably leaks memory
            if (!page.isConnected) browser.runtime.onMessage.removeListener(onMessage)
            if (message.type === "hook-text") {
                const text: string = message.text
                const name: string | undefined = message.name
                const index = parsedData.messages.findIndex(e => e.name === name && e.text === text)
                if (index !== -1) {
                    // TODO highlight in the reader
                    return
                }
                const hookMessage: HookMessage = { text }
                if (name) hookMessage.name = name
                parsedData.messages.push(hookMessage)
                page.append(this.MessageToParagraph(message)) // TODO these are missing nice features since they don't go through enhance
                this.Enqueue(async () => {
                    const page = this.ReaderPage
                    if (!page) return
                    const library = page.Library
                    if (!library) return
                    const cache = library.Cache
                    if (!this.Book.cacheKey) return
                    const jsonString = JSON.stringify(parsedData)
                    const blob = new Blob([jsonString])
                    const response = new Response(blob, {
                        headers: {
                            "Content-Type": "application/json",
                            "Content-Length": blob.size.toString()
                        }
                    })
                    await cache.put(this.Book.cacheKey, response)
                })
            }
        }
        browser.runtime.onMessage.addListener(onMessage)
        return this.page
    }

    page: ReaderPageNode | undefined

    constructor(book: LibraryBook) {
        super(book)
    }

    Queue: (() => Promise<unknown>)[] = []
    Running = false
    Enqueue(promise: () => Promise<unknown>) {
        this.Queue.push(promise)
        this.Dequeue()
    }
    async Dequeue() {
        if (this.Queue.length === 0 || this.Running) return
        this.Running = true
        while (this.Queue.length > 0) {
            const e = this.Queue.shift()!
            try {
                await e()
            } catch (e) { console.error(e) }
        }
        this.Running = false
    }
}
