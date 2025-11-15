import { getAnkiWords } from "../anki/CardList";
import CheckboxField from "../components/basic/CheckboxField";
import IconButton from "../components/basic/IconButton";
import UpDownButtons from "../components/basic/UpDownButtons";
import Loader from "../components/Loader";
import { OpenModal } from "../components/Modal";
import { IgnoreVid, loadIgnoreList, UnIgnoreVid } from "../jpdb/IgnoreList";
import { getVocabState, VocabState } from "../jpdb/JpdbParseText";
import { tryPlayAudio } from "../utils/Audio";
import { SubtitleEntry, Subtitles } from "../utils/srt";
import { seekToNextEntry } from "./subtitles";
// TODO ^ this import is really dangerous

export default (subtitles: Subtitles) => {
    const jpdb = subtitles.jpdbParse
    if (!jpdb) return

    let showIgnored = false
    let showKana = false

    const load = async () => {
        const body = <></>
        await getAnkiWords()
        await loadIgnoreList()
        const sorted = jpdb.vocabulary.toSorted((a, b) => (a[2] ?? Number.MAX_SAFE_INTEGER) - (b[2] ?? Number.MAX_SAFE_INTEGER))
        for (let i = 0; i < sorted.length; i++) {
            if (body.childElementCount >= 50) break
            const vocab = sorted[i]
            const state = getVocabState(vocab)
            if (state !== VocabState.New) {
                if (state === VocabState.Ignored) { if (!showIgnored) continue }
                else if (state === VocabState.Kana) { if (!showKana) continue }
                else continue
            }
            const tokenUsages: number[] = []
            for (const token of jpdb.tokens) {
                const v = jpdb.vocabulary[token[3]]
                if (v === vocab) tokenUsages.push(token[0])
            }
            let ignored = state === VocabState.Ignored
            const makeDeleteButton = () => <IconButton icon={ignored ? "restore_from_trash" : "delete"}
                title={ignored ? "Restore" : "Ignore"}
                onClick={async () => {
                    if (ignored) {
                        ignored = false
                        await UnIgnoreVid(vocab[5])
                        row.classList.remove("ignored")
                    } else {
                        ignored = true
                        await IgnoreVid(vocab[5])
                        row.classList.add("ignored")
                    }
                    // this is sketchy, but works
                    deleteButton.replaceWith(deleteButton = makeDeleteButton())
                }} />
            let deleteButton = makeDeleteButton()
            const row = <div className="vocab-row">
                {deleteButton}
                <span className="frequency">{vocab[2] ?? "N/A"}</span>
                <UpDownButtons onClick={(_, down) => {
                    const options: SubtitleEntry[] = []
                    for (const entry of subtitles.processedEntries) {
                        const end = entry.characterOffset + entry.text.length
                        for (const token of tokenUsages) {
                            if (entry.characterOffset <= token && token < end) {
                                options.push(entry)
                            }
                        }
                    }
                    seekToNextEntry(options, !down)
                }}>
                    <span className="usage-count">{tokenUsages.length}</span>
                </UpDownButtons>
                <IconButton icon="play_arrow" onClick={() => tryPlayAudio(vocab)} />
                <span>{vocab[0]} - {vocab[3][0]}</span>
            </div>
            if (state === VocabState.Ignored) row.classList.add("ignored")
            if (state === VocabState.Kana) row.classList.add("kana")
            body.append(row)
        }
        return body
    }

    const body = <div />
    const reload = () => {
        body.replaceChildren(<Loader load={load} />)
    }
    reload()


    const res = OpenModal({
        header: "Recommended Vocab",
        body: <>
            <div className="filters">
                <CheckboxField label="Ignored" id="show-ignored" onChange={v => {
                    showIgnored = v
                    reload()
                }} />
                <CheckboxField label="Kana" id="show-kana" onChange={v => {
                    showKana = v
                    reload()
                }} />
            </div>
            {body}
        </>,
        id: "recommended-mining-modal",
        allowMinimize: true
    })
    return res
} 