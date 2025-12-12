import Loader from "../components/Loader"
import LoadingButton from "../components/LoadingButton"
import AnkiConnect, { AnkiNote } from "../utils/AnkiConnect"

interface GroupingInfo<T> {
    key: (e: T) => string | number
    name?: (key: string | number, values: T[]) => string // not used yet
    sortBy?: (key: string | number, values: T[]) => number
    disabled?: true
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
        const anki = new AnkiConnect()
        const notes = await anki.call("notesInfo", { query: "" })
        const final = (e: AnkiNote) => e.fields.Word.value
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
                    if (e.noteId - lastTimeGroup > 60 * 60 * 1_000)
                        currentTimeGroup = new Date(e.noteId).toLocaleString()
                    lastTimeGroup = e.noteId
                    return currentTimeGroup
                },
                disabled: true
            },
            {
                key: e => {
                    let source = e.fields.Source.value
                    if (!source) return "No source"
                    const slash = source.indexOf("/")
                    if (slash >= 0) source = source.substring(0, slash)
                    const epRegex = /\s+S\d{1,2}E\d{1,3}$/g
                    return source.replaceAll(epRegex, "")
                }
            },
            {
                key: e => {
                    const source = e.fields.Source.value
                    if (!source) return "No source"
                    const slash = source.indexOf("/")
                    if (slash >= 0) return source.substring(0, slash)
                    return source
                }
            }
        ]
        groupings = groupings.filter(e => !e.disabled)
        const res = <div className="tree" />
        function renderGroup(notes: AnkiNote[], i: number) {
            const info = groupings[i]
            const groups: Map<string | number, AnkiNote[]> = new Map()
            const keys = []
            for (const note of notes) {
                const key = info.key(note)
                const group = groups.get(key)
                if (group) group.push(note)
                else {
                    groups.set(key, [note])
                    keys.push(key)
                }
            }
            const sortBy = info.sortBy
            if (sortBy) keys.sort((a, b) => sortBy(a, groups.get(a)!) - sortBy(b, groups.get(b)!))
            const res: HTMLDetailsElement[] = []
            for (const key of keys) {
                const group = groups.get(key)!
                const d = <details className="node">
                    <summary>{group.length} - {key}</summary>
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
            {renderGroup(notes, 0)}
        </details>)
        return res
    }
    const res = <div>
        <LoadingButton onClick={load}>Recently Mined View</LoadingButton>
    </div>
    return res
}