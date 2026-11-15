import { appendChild } from '../framework/createElement'
import { CurrentPage } from '../framework/Router'
import ReaderPage from '../pages/reader/ReaderPage'
import { BaseReader, ReaderPageNode } from './BaseReader'
import { LibraryBook } from './Library'

interface HookMessage {
    name?: string
    text?: string
    options?: string[]
}

interface HookData {
    messages: HookMessage[]
}

class OnConnectElement extends HTMLElement {
    OnConnect?: (connected: boolean) => void
    connectedCallback() { this.OnConnect?.(true) }
    disconnectedCallback() { this.OnConnect?.(false) }
}
customElements?.define("on-connect", OnConnectElement)

export class HookReader extends BaseReader {
    override get PageCount(): number {
        return 1
    }

    MessageToNode(message: HookMessage) {
        // Could skip the div if there's no name/options
        const node = <div />
        const paragraph = <p />
        if (message.name || message.text) {
            if (message.name) paragraph.append(<span className="hook-message-name">{message.name}</span>)
            if (message.text) paragraph.append(message.text)
        }
        node.append(paragraph)
        if (message.options) {
            appendChild(node, message.options.map((e: any) => <div className="option">{e}</div>))
        }
        return node
    }
    override async ReadPage(_: number): Promise<ReaderPageNode> {
        if (this.page) return this.page

        const page = <div className="reader-page-node hook-reader" /> as ReaderPageNode
        const onConnect = new OnConnectElement()
        const advance = async () => {
            const tabs = await browser.tabs.query({ url: this.Book.key as string })
            for (const tab of tabs) {
                if (tab.id) {
                    await browser.tabs.sendMessage(tab.id, { type: "advance-page" })
                }
            }
        }
        onConnect.OnConnect = connected => {
            const onKeydown = async (e: KeyboardEvent) => {
                if (e.key === " ") {
                    e.preventDefault()
                    await advance()
                }
            }
            if (connected) {
                browser.runtime.onMessage.addListener(onMessage)
                document.addEventListener("keydown", onKeydown)
            }
            else {
                browser.runtime.onMessage.removeListener(onMessage)
                document.removeEventListener("keydown", onKeydown)
            }
        }
        page.append(onConnect)
        page.append(<button onclick={advance} id="advance-button">Advance</button>)
        this.page = page
        let tempData: Partial<HookData> = {}
        if (typeof this.Book.data === "string") {
            try { tempData = JSON.parse(this.Book.data) } catch { }
        } else if (this.Book.data instanceof Blob) {
            try { tempData = JSON.parse(await this.Book.data.text()) } catch { }
        }
        tempData.messages ??= []
        const parsedData = tempData as HookData
        for (const message of parsedData.messages)
            page.append(this.MessageToNode(message))

        const onMessage = async (message: any) => {
            if (message.type === "hook-text") {
                const readerPage = CurrentPage(ReaderPage)
                const text: string | undefined = message.text
                const name: string | undefined = message.name
                const options: string[] | undefined = message.options
                if (!text && !options?.length) return
                const index = parsedData.messages.findIndex(e => {
                    if ((e.name ?? "") !== (name ?? "")) return false
                    if ((e.text ?? "") !== (text ?? "")) return false
                    if ((e.options?.length ?? 0) !== (options?.length ?? 0)) return false
                    if (options && e.options) {
                        for (let i = 0; i < options.length; i++) {
                            if (options[i] !== e.options[i]) return false
                        }
                    }
                    return true
                })
                if (index !== -1) {
                    readerPage?.FocusParagraph(index)
                    return
                }
                const hookMessage: HookMessage = {}
                if (text) hookMessage.text = text
                if (name) hookMessage.name = name
                if (options && options.length > 0) hookMessage.options = options
                parsedData.messages.push(hookMessage)
                this.QueueSaveBookData(parsedData)

                // TODO probably has some sketchy race conditions with the furigana stuff
                await readerPage?.AppendNode(this.MessageToNode(message))
            }
        }
        return this.page
    }

    QueueSaveBookData(parsedData: HookData) {
        this.Enqueue(async () => {
            const readerPage = CurrentPage(ReaderPage)
            if (!readerPage) return
            const library = readerPage.Library
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
