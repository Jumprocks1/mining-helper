import IconButton from "../components/basic/IconButton"
import Loader from "../components/Loader"
import LoadingButton from "../components/LoadingButton"
import { OpenModal } from "../components/Modal"
import { triggerSettingChanged } from "./SettingsModal"

export interface ReplacementEntry {
    match: string | RegExp
    replace: string
    early?: boolean
}

export async function applyRegexTo(s: string, mining: boolean) {
    return applyReplacementsTo(await getReplacements(), s, mining)
}
export function applyReplacementsTo(replacements: ReplacementEntry[], s: string, mining: boolean) {
    for (const replacement of replacements) {
        if ((replacement.early ?? false) === mining) continue
        const regex = new RegExp(replacement.match, "g")
        s = s.replaceAll(regex, replacement.replace)
    }
    return s
}

export async function getReplacements() {
    return (await chrome.storage.local.get({ regexReplacements: [] })).regexReplacements as ReplacementEntry[]
}

export default () => {
    let rowBody = <div className="row-container"></div>
    let replacements: ReplacementEntry[] = []
    function renderEntry(entry: ReplacementEntry) {
        function updateButton() {
            if (entry.early) toggleButton.classList.add("fill")
            else toggleButton.classList.remove("fill")
            toggleButton.title = entry.early ? "Click to only apply when mining" : "Click to apply when loading subtitles"
        }
        const toggleButton = <IconButton icon="star" onClick={() => {
            entry.early = !entry.early
            updateButton()
        }} />
        updateButton()

        const node = <div className="row">
            <input className="regex-match" value={entry.match.toString()} />
            <input className="regex-replace" value={entry.replace} />
            {toggleButton}
            <IconButton icon="close" onClick={() => {
                node.remove()
                replacements.splice(replacements.indexOf(entry), 1)
            }} />
        </div>
        return node
    }

    const load = (async () => {
        replacements = await getReplacements()
        rowBody.replaceChildren(...replacements.map(renderEntry))
        return rowBody
    })()
    const body = <div className="regex-replacements-modal">
        <div><LoadingButton onClick={() => {
            replacements.push({ match: "", replace: "" })
            rowBody.append(renderEntry(replacements[replacements.length - 1]))
        }} loading={load}>New</LoadingButton></div>
        <Loader load={load} />
        <div><LoadingButton onClick={async () => {
            const children = rowBody.children
            for (let i = 0; i < children.length; i++) {
                const row = children.item(i)
                if (row) {
                    replacements[i].match = row.querySelector<HTMLInputElement>(".regex-match")!.value;
                    replacements[i].replace = row.querySelector<HTMLInputElement>(".regex-replace")!.value;
                }
            }
            await chrome.storage.local.set({ regexReplacements: replacements })
            triggerSettingChanged("regexReplacements", replacements)
        }} loading={load}>Save</LoadingButton></div>
    </div>

    return OpenModal({
        header: "Regex Replacements",
        body
    })
}