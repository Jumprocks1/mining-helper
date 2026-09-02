import IconButton from "../components/basic/IconButton"
import Loader from "../components/Loader"
import LoadingButton from "../components/LoadingButton"
import { OpenModal } from "../components/Modal"
import { BrowserStorage } from "../utils/BrowserApi"
import { triggerSettingChanged } from "./SettingsModal"

export interface ReplacementEntry {
    match: string | RegExp
    replace: string
}

export async function applyRegexTo(s: string) {
    return applyReplacementsTo(await getReplacements(), s)
}
export function applyReplacementsTo(replacements: ReplacementEntry[], s: string) {
    for (const replacement of replacements) {
        const regex = new RegExp(replacement.match, "g")
        s = s.replaceAll(regex, replacement.replace)
    }
    return s
}

export async function getReplacements() {
    return (await BrowserStorage.local.get({ regexReplacements: [] })).regexReplacements as ReplacementEntry[]
}

export default () => {
    let rowBody = <div className="row-container"></div>
    let replacements: ReplacementEntry[] = []
    function renderEntry(entry: ReplacementEntry) {
        const node = <div className="row">
            <input className="regex-match" value={entry.match.toString()} />
            <input className="regex-replace" value={entry.replace} />
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
            await BrowserStorage.local.set({ regexReplacements: replacements })
            triggerSettingChanged("regexReplacements", replacements)
        }} loading={load}>Save</LoadingButton></div>
    </div>

    return OpenModal({
        header: "Regex Replacements",
        body
    })
}