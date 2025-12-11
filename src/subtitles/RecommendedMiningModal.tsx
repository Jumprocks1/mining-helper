import { getAnkiWords } from "../anki/CardList";
import CheckboxField from "../components/basic/CheckboxField";
import IconButton from "../components/basic/IconButton";
import UpDownButtons from "../components/basic/UpDownButtons";
import Loader from "../components/Loader";
import { OpenModal } from "../components/Modal";
import { IgnoreVid, loadIgnoreList, UnIgnoreVid } from "../jpdb/IgnoreList";
import { JpdbVocabulary } from "../jpdb/JpdbParseText";
import { getN1Tokens, getVocabState, getVocabStateAndNote, VocabState, VocabStateConfig } from "../jpdb/JpdbState";
import { tryPlayAudio } from "../utils/Audio";
import { setSelection } from "../utils/CharacterHighlighter";
import { ClearEventHandler, RegisterEventHandler } from "../utils/Events";
import { SubtitleEntryWithCharacterOffset, Subtitles } from "../utils/srt";
import { CardData } from "../utils/util";
import { seekToNextEntry } from "./subtitles";
// TODO ^ this import is really dangerous

export default (subtitles: Subtitles) => {
    const jpdb = subtitles.jpdbParse
    if (!jpdb) return

    let showIgnored = false
    let showKana = false
    let n1 = false
    let trimKana = false
    let chronological = false

    let loadedRows: Record<number, HTMLElement> | undefined = undefined

    const load = async () => {
        const body = <></>
        await getAnkiWords()
        await loadIgnoreList()

        const stateConfig: VocabStateConfig = {
            trimKana,
            kanaUnknown: showKana
        }

        const n1Ids = n1 && getN1Tokens(subtitles, jpdb, stateConfig)

        loadedRows = {}
        const sorted = jpdb.vocabulary.toSorted((a, b) => (a[2] ?? Number.MAX_SAFE_INTEGER) - (b[2] ?? Number.MAX_SAFE_INTEGER))
        const pendingRows: [JpdbVocabulary, HTMLElement][] = []
        for (let i = 0; i < sorted.length; i++) {
            if (body.childElementCount >= 50) break
            const vocab = sorted[i]
            let state = getVocabState(vocab, stateConfig)
            let ignored = state === VocabState.Ignored

            if (showIgnored && state === VocabState.Ignored) {
                const newState = getVocabStateAndNote(vocab, {
                    ...stateConfig,
                    skipIgnoreCheck: true
                })[0]
                if (newState === VocabState.Kana)
                    state = newState
            }

            if (state !== VocabState.New) {
                if (state === VocabState.Ignored) { if (!showIgnored) continue }
                else if (state === VocabState.Kana) { if (!showKana) continue }
                else continue
            }
            let tokenUsages: number[]
            if (n1Ids) {
                const found = n1Ids.get(vocab[5])
                if (!found) continue
                tokenUsages = found
            } else {
                tokenUsages = []
                for (const token of jpdb.tokens) {
                    const v = jpdb.vocabulary[token[3]]
                    if (v === vocab) tokenUsages.push(token[0])
                }
            }
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
                    const options: [sub: SubtitleEntryWithCharacterOffset, token: number][] = []
                    for (const entry of subtitles.processedEntries) {
                        const end = entry.characterOffset + entry.text.length
                        for (const token of tokenUsages) {
                            if (entry.characterOffset <= token && token < end) {
                                options.push([entry, token])
                            }
                        }
                    }
                    const index = seekToNextEntry(options.map(e => e[0]), !down)
                    if (index !== undefined) {
                        const [entry, tokenStart] = options[index]
                        // this is lame
                        const token = jpdb.tokens.find(e => e[0] === tokenStart)
                        if (!token) return
                        const node = entry.node?.querySelector<HTMLDivElement>(".subtitles")
                        setSelection(node, tokenStart - entry.characterOffset, tokenStart + token[1] - entry.characterOffset)
                    }
                }}>
                    <span className="usage-count">{tokenUsages.length}</span>
                </UpDownButtons>
                <IconButton icon="play_arrow" onClick={() => tryPlayAudio(vocab)} />
                <span>{vocab[0]} - {vocab[3][0]}</span>
            </div>
            if (state === VocabState.Ignored) row.classList.add("ignored")
            if (state === VocabState.Kana) row.classList.add("kana")
            loadedRows[vocab[5]] = row
            pendingRows.push([vocab, row])
        }
        if (chronological) {
            const pendingWithIndex = pendingRows.map(e => {
                const firstIndex = jpdb.tokens.findIndex(t => jpdb.vocabulary[t[3]] === e[0])
                return [firstIndex, e[1]] as [number, HTMLElement]
            })
            pendingWithIndex.sort((a, b) => {
                if (a[0] > b[0]) return 1
                else if (a[0] < b[0]) return -1
                else return 0
            })
            for (const [_, row] of pendingWithIndex) {
                body.append(row)
            }
        } else {
            for (const [_, row] of pendingRows) {
                body.append(row)
            }
        }
        return body
    }

    const body = <div className="row-container" />
    const reload = () => {
        loadedRows = undefined
        body.replaceChildren(<Loader load={load} />)
    }
    reload()

    function mineHandler(card: CardData) {
        if (loadedRows && card.vid !== undefined && loadedRows[card.vid]) {
            loadedRows[card.vid].classList.add("known")
        }
    }


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
                <CheckboxField label="N+1" id="show-n1" onChange={v => {
                    n1 = v
                    reload()
                }} />
                <CheckboxField label="Kana Trim" id="trim-kana" onChange={v => {
                    trimKana = v
                    reload()
                }} />
                <CheckboxField label="Chronological" onChange={v => {
                    chronological = v
                    reload()
                }} />
            </div>
            {body}
        </>,
        id: "recommended-mining-modal",
        allowMinimize: true,
        onClose: () => ClearEventHandler("vocab-mined", mineHandler)
    })
    RegisterEventHandler("vocab-mined", mineHandler)
    return res
} 