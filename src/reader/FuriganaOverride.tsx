import IconButton from "../components/basic/IconButton"
import Loader from "../components/Loader"
import LoadingButton from "../components/LoadingButton"
import { OpenModal } from "../components/Modal"
import { getSetting, getSettingAndCache, setSetting } from "../core/Settings"
import { furiToRuby } from "../utils/util"

export default function () {
    const selection = getSelection()
    if (!selection) return
    const range = selection?.getRangeAt(0)
    if (!range) return
    // This handles partial ruby selections
    expandRubyRange(range)
    selection.removeAllRanges()
    selection.addRange(range)
    const selectionText = selection?.toString()
    if (!selectionText) return
    let baseText = selectionText
    // cloneContents is nice because it splits up partial nodes
    // it's also bad because it skips <rt> sometimes (happens if selection is only halfway through a character)
    const fragment = range.cloneContents()
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode: node => {
            if (node.nodeName === "RUBY" || node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT
            return NodeFilter.FILTER_SKIP
        }
    })
    let furigana = ""
    let currentNode = walker.nextNode()
    while (currentNode) {
        if (currentNode.nodeName === 'RUBY') {
            if (furigana && furigana[furigana.length - 1] != "]") furigana += " "
            for (const node of currentNode.childNodes) {
                if (node.nodeName === "RT") {
                    furigana += `[${node.textContent?.trim() ?? ""}]`
                } else {
                    furigana += node.textContent?.trim() ?? ""
                }
            }
            currentNode = walker.nextSibling()
        } else if (currentNode.nodeType === Node.TEXT_NODE) {
            furigana += currentNode.textContent;
            currentNode = walker.nextNode()
        }
    }
    overrideModal(baseText, furigana)
}

function overrideModal(baseText: string, furigana: string) {
    const preview = <div className="preview" />
    function refreshPreview() {
        preview.replaceChildren(furiToRuby(furigana))
    }
    refreshPreview()
    const modal = OpenModal({
        header: "Overriding Furigana",
        body: <div>
            <label className="label-field">
                Base Text
                <input defaultValue={baseText} onchange={ev => baseText = (ev.currentTarget as HTMLInputElement).value} />
            </label>
            <label className="label-field">
                Furigana
                <input defaultValue={furigana}
                    oninput={e => { furigana = (e.target as HTMLInputElement).value; refreshPreview() }}
                    onchange={e => { furigana = (e.target as HTMLInputElement).value; refreshPreview() }} />
            </label>
            <div className="label">Preview</div>
            {preview}
        </div>,
        footer: async () => {
            const overrides = await getSetting("furiganaOverrides")
            const exists = baseText in overrides
            return <>
                {<button onclick={() => {
                    modal.Close()
                    AllFuriganaOverrides()
                }}>
                    View All
                </button>}
                {exists && <LoadingButton onClick={async () => {
                    delete overrides[baseText]
                    await setSetting("furiganaOverrides", overrides)
                    modal.Close("removed")
                }}>Remove</LoadingButton>}
                <LoadingButton onClick={async () => {
                    overrides[baseText] = furigana
                    await setSetting("furiganaOverrides", overrides)
                    modal.Close("saved")
                }}>Save</LoadingButton>
            </>
        },
        id: "furigana-override-modal"
    })
    return modal
}


// Accounts for a partial selection of a character not necessarily including the <rt> tag
// Technically this can end up including more than the user wanted, but in those (rare) cases,
//   they can delete that from the preview
function expandRubyRange(range: Range) {
    for (const container of [range.startContainer, range.endContainer]) {
        const ruby = container instanceof Element
            ? container.closest("ruby")
            : container.parentElement?.closest("ruby")
        if (!ruby) continue
        if (container === range.startContainer) range.setStartBefore(ruby)
        else range.setEndAfter(ruby)
    }
}

function AllFuriganaOverrides() {
    const load = async () => {
        const overrides = await getSettingAndCache("furiganaOverrides")
        const overrideList = Object.entries(overrides).reverse()
        const body = <tbody>
            {overrideList.map(e => {
                const row = <tr>
                    <td>{e[0]}</td>
                    <td>{furiToRuby(e[1])}</td>
                    <td>
                        <div className="row">
                            <IconButton icon="edit" onClick={async () => overrideModal(e[0], e[1])
                                .RegisterOnClose(e => { if (e) modal.Reload(load) })} />
                            <IconButton icon="delete"
                                onClick={async () => {
                                    delete overrides[e[0]]
                                    await setSetting("furiganaOverrides", overrides)
                                    row.remove()
                                }} />
                        </div>
                    </td>
                </tr>
                return row
            })}
        </tbody>
        return <table>
            <thead>
                <tr>
                    <th>Base</th>
                    <th>Furigana</th>
                    <th />
                </tr>
            </thead>
            {body}
        </table>
    }

    const modal = OpenModal({
        header: "Furigana Overrides",
        body: load,
        id: "all-furigana-overrides-modal"
    })
    return modal
}