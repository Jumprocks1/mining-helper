import Loader from "../../components/Loader"
import LoadingButton from "../../components/LoadingButton"
import AnkiConnect, { AnkiNote } from "../../utils/AnkiConnect"
import { AnkiFieldInfo, AnkiFieldKey, getSetting } from "../../views/SettingsModal"

interface GroupingInfo<T> {
    key: (e: T) => string | number
    name?: (key: string | number, values: T[]) => string
    hide?: (key: string | number, values: T[]) => boolean
    sortBy?: (key: string | number, values: T[]) => string | number
    disabled?: true
}

function cleanSource(source: string) {
    if (!source) return "No source"
    const slash = source.indexOf("/")
    if (slash >= 0) source = source.substring(0, slash)
    return source.replace(/[\s\-]+$/, "")
}

export default () => {
    let loadedSection: HTMLElement | undefined
    const load = () => {
        if (!loadedSection) res.appendChild(loadedSection = <div />)
        const promise = innerLoad()
        loadedSection.replaceChildren(<Loader load={promise} />)
        return promise
    }
    const innerLoad = async () => {
        const notes = await AnkiConnect.call("notesInfo", { query: "" })
        const configuredFields = await getSetting("ankiFields")
        function fieldName(key: AnkiFieldKey) {
            return configuredFields[key] ?? AnkiFieldInfo[key].name
        }
        const final = (e: AnkiNote) => e.fields[fieldName("word")]?.value
        let currentTimeGroup = "N/A"
        let lastTimeGroup = 0
        let groupings: GroupingInfo<AnkiNote>[] = [
            {
                key: e => {
                    const date = new Date(e.noteId)
                    return date.toISOString().substring(0, 7)
                },
                disabled: true
            },
            {
                key: e => {
                    const date = new Date(e.noteId)
                    return date.toISOString().substring(0, 10)
                },
                disabled: true
            },
            {
                key: e => {
                    const source = cleanSource(e.fields[fieldName("source")]!.value)
                    const epRegex = /\s*\-?\s+S\d{1,2}E\d{1,3}$|\s*\-?\s+S\d{1,2} - E?\d{1,3}$|\s*\-\s+(\d{1,3}|OVA)$/g
                    return source.replaceAll(epRegex, "")
                }
            },
            {
                key: e => cleanSource(e.fields[fieldName("source")]!.value)
            },
            {
                key: e => {
                    if (e.noteId - lastTimeGroup > 30 * 60 * 1_000)
                        currentTimeGroup = new Date(e.noteId).toLocaleString()
                    lastTimeGroup = e.noteId
                    return currentTimeGroup
                },
                sortBy: e => e,
                disabled: true
            },
        ]
        groupings = groupings.filter(e => !e.disabled)
        const res = <div className="tree" />
        function renderGroup(notes: AnkiNote[], i: number) {
            const info = groupings[i]
            const groups: Map<string | number, AnkiNote[]> = new Map()
            const keys = []
            let maxLength = 0
            lastTimeGroup = 0
            for (const note of notes) {
                const key = info.key(note)
                const group = groups.get(key)
                if (group) {
                    group.push(note)
                    if (group.length > maxLength) maxLength = group.length
                }
                else {
                    groups.set(key, [note])
                    keys.push(key)
                }
            }
            const sortBy = info.sortBy
            if (sortBy) keys.sort((a, b) => {
                const aS = sortBy(a, groups.get(a)!)
                const bS = sortBy(b, groups.get(b)!)
                return aS > bS ? 1 : bS > aS ? - 1 : 0
            })
            const formatLength = maxLength.toString().length // eww
            const res: HTMLDetailsElement[] = []
            for (const key of keys) {
                const group = groups.get(key)!
                if (info.hide && info.hide(key, group)) continue
                const d = <details className="node">
                    <summary>
                        <span className="count">{group.length.toString().padEnd(formatLength, " ")}</span>
                        {" - "}{info.name ? info.name(key, group) : key}
                    </summary>
                </details> as HTMLDetailsElement
                if (i === groupings.length - 1) {
                    for (const note of group) {
                        d.appendChild(<div className="node">{final(note)}</div>)
                    }
                } else {
                    d.append(...renderGroup(group, i + 1))
                }
                res.push(d)
            }

            return res;
        }
        res.appendChild(<details open className="node">
            <summary>Anki Cards</summary>
            {renderGroup(notes.reverse(), 0)}
        </details>)
        return res
    }
    const res = <div>
        <LoadingButton onClick={load}>Recently Mined View</LoadingButton>
    </div>
    return res
}