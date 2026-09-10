import IconButton, { Icon } from "../../components/basic/IconButton"
import Loader from "../../components/Loader"
import { OpenModal } from "../../components/Modal"
import { CurrentPage } from "../../framework/Router"
import { Library } from "../../reader/Library"
import ReaderPage from "./ReaderPage"

// TODO should allow dropping file into here
export default () => {
    const loadBody = async () => {
        const library = await Library.Instance()
        const books = library.books
        if (books.length === 0) return "No books loaded. Drag + drop on reader page to load."
        const cacheKeys = new Map<string, number>()
        for (const e of (await library.Cache.keys())) {
            const request = await library.Cache.match(e.url)
            if (!request) continue
            cacheKeys.set(e.url, parseInt(request.headers.get("content-length") ?? "0"))
        }
        return <table>
            <thead>
                <tr>
                    <th></th>
                    <th>Name</th>
                    <th>Page</th>
                    <th>Type</th>
                    <th>Source</th>
                    <th>Cached</th>
                </tr>
            </thead>
            <tbody>
                {books.map(e => {
                    let cachedSize = e.cacheKey !== undefined && cacheKeys.get(e.cacheKey)
                    if (cachedSize !== undefined && cachedSize !== false && e.source === "url-template") {
                        const key = e.key.toString()
                        if (e.pageCount && key.includes("$page")) {
                            for (let i = 1; i <= e.pageCount; i++) {
                                const url = key.replaceAll("$page", i.toString())
                                cachedSize += cacheKeys.get(url) ?? 0
                            }
                        }
                    }
                    const canOpen = (e.cacheKey && cacheKeys.has(e.cacheKey)) || e.source === "url" || e.source === "url-template"
                    let name = e.name
                    // Could name these like 1/2/3 as they come in eventually
                    if (!name && e.source === "clipboard") name = "Clipboard"
                    if (!name) name = e.key.toString()
                    let progress = e.progress ? e.progress.page + 1 : "0"
                    if (e.pageCount) progress += " / " + e.pageCount
                    const type = e.contentType === "text/html" ? "HTML" :
                        e.contentType === "application/epub+zip" ? "EPUB" :
                            e.contentType === "text/plain" ? "Text" : e.contentType
                    const nameCell = <td className="clickable" onclick={() => {
                        // TODO I like this pattern, should make it reusable
                        if (nameCell.querySelector("input")) return
                        let committed = false
                        const commit = async () => {
                            if (committed) return
                            committed = true
                            e.name = input.value.trim()
                            input.replaceWith(e.name)
                            await library.Save()
                        }
                        const input = <input type="string" onblur={commit} onkeydown={ev => { if (ev.key === "Enter") commit() }} /> as HTMLInputElement
                        input.value = nameCell.textContent
                        nameCell.replaceChildren(input)
                        input.focus()
                        input.select()
                    }}>{name}</td>
                    const row = <tr>
                        <td>
                            <div className="button-row">
                                <IconButton icon="delete" onClick={async () => {
                                    await library.RemoveBook(e)
                                    row.remove()
                                }} tooltip="Delete" />
                                <IconButton icon="open_in_browser"
                                    onClick={async () => {
                                        const page = CurrentPage()
                                        if (page instanceof ReaderPage) {
                                            await page.LoadBook(e)
                                            modal.Close()
                                        }
                                    }}
                                    disabled={!canOpen} tooltip={canOpen ? "Open" : "Can't open, missing from cache"} />
                            </div>
                        </td>
                        {nameCell}
                        <td>{progress}</td>
                        <td>{type}</td>
                        <td>{e.source}</td>
                        <td className="cached">
                            <div>
                                {cachedSize ? byteFormat(cachedSize) : <Icon className="error" icon="close" />}
                            </div>
                        </td>
                    </tr>
                    return row
                })}
            </tbody>
        </table>
    }

    const addUrlNode = <button onclick={() => {
        let committed = false
        const commit = async () => {
            if (committed) return
            committed = true
            const value = input.value
            input.replaceWith(addUrlNode)
            const library = await Library.Instance()
            library.books.push({ key: value, source: value.includes("$page") ? "url-template" : "url" })
            await library.Save()
            modal.Body.replaceChildren(<Loader load={loadBody} />)
        }
        const input = <input type="string" onblur={commit} onkeydown={ev => { if (ev.key === "Enter") commit() }} /> as HTMLInputElement
        addUrlNode.replaceWith(input)
        input.focus()
    }} tooltip={<div>Replace the page number with <em>$page</em> to enable pagination.{"\n"}
        Ex: https://ncode.syosetu.com/n2267be/$page/</div>}>Add URL</button>
    const modal = OpenModal({
        header: "Library",
        id: "library-modal",
        body: <Loader load={loadBody} />,
        footer: <div>{addUrlNode}</div>
    })
    return modal
}

function byteFormat(bytes: number) {
    if (isNaN(bytes)) return
    const sizes = ["B", "KB", "MB", "GB"]
    let k = 1
    let i = 0
    while (bytes > k * 1024 && i < sizes.length - 1) {
        k *= 1024
        i += 1
    }
    return (bytes / k).toFixed(1) + " " + sizes[i]
}
