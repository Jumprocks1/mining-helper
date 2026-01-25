import { getAnkiWords } from "../../pages/anki/CardList";
import CheckboxField from "../../components/basic/CheckboxField";
import IconButton from "../../components/basic/IconButton";
import NumberField from "../../components/basic/NumberField";
import UpDownButtons from "../../components/basic/UpDownButtons";
import Loader from "../../components/Loader";
import { OpenModal } from "../../components/Modal";
import { IgnoreVid, loadIgnoreList, UnIgnoreVid } from "../../jpdb/IgnoreList";
import { JpdbParseSubtitles, JpdbToken, JpdbVocabulary } from "../../jpdb/JpdbParseText";
import { getN1Tokens, getVocabState, getVocabStateAndNote, VocabState, VocabStateConfig } from "../../jpdb/JpdbState";
import { tryPlayAudio } from "../../utils/Audio";
import { setSelection } from "../../utils/CharacterHighlighter";
import { ClearEventHandler, RegisterEventHandler } from "../../utils/Events";
import { SubtitleEntryWithCharacterOffset, Subtitles } from "../../utils/srt";
import { CardData } from "../../utils/util";
import { getSetting, setSetting } from "../../views/SettingsModal";
import SubtitlesPage from "./subtitles";
import JpHoverTooltip from "./JpHoverTooltip";


declare global {
    interface HTMLElement {
        vocabInfo?: [vocab: JpdbVocabulary, token: JpdbToken]
    }
}

export default async (subtitles: Subtitles, getMinimizeTarget: () => DOMRect | undefined, subtitlesPage: SubtitlesPage) => {
    if (!subtitles.jpdbParse) await subtitlesPage.TryJpdbParse();
    const jpdb = subtitles.jpdbParse
    if (!jpdb) return

    let showIgnored = false
    let showKana = false
    let n1 = false
    const pending = [getSetting("miningTrimKana"), getSetting("miningChronological"), getSetting("miningMaxFrequency"), getSetting("miningMaxRecommendedCount")] as const
    let trimKana = await pending[0]
    let chronological = await pending[1]
    let maxFrequency = await pending[2]
    let maxCount = await pending[3]

    let loadedRows: Record<number, HTMLElement> | undefined = undefined
    const body = <div className="row-container" />

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
            .filter(e => (e[2] ?? Number.MAX_SAFE_INTEGER) < maxFrequency)
        const pendingRows: [JpdbVocabulary, HTMLElement, firstUsagePosition: number][] = []
        for (let i = 0; i < sorted.length; i++) {
            if (pendingRows.length >= maxCount) break
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
            let firstToken: JpdbToken | undefined // needed for furigana parsing on tooltip
            let tokenUsages: number[]
            if (n1Ids) {
                const found = n1Ids.get(vocab[5])
                if (!found) continue
                tokenUsages = found
            } else {
                tokenUsages = []
                for (const token of jpdb.tokens) {
                    const v = jpdb.vocabulary[token[3]]
                    if (v === vocab) {
                        firstToken ??= token
                        tokenUsages.push(token[0])
                    }
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
                    const index = subtitlesPage.SeekToNextEntry(options.map(e => e[0]), !down)
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
                <span><span className="vocab-kanji">{vocab[0]}</span> - {vocab[3][0]}</span>
            </div>
            if (firstToken) row.vocabInfo = [vocab, firstToken] // for tooltip
            if (state === VocabState.Ignored) row.classList.add("ignored")
            if (state === VocabState.Kana) row.classList.add("kana")
            loadedRows[vocab[5]] = row
            pendingRows.push([vocab, row, tokenUsages[0]])
        }
        if (chronological) pendingRows.sort((a, b) => a[2] - b[2])
        for (const [_, row] of pendingRows) {
            body.append(row)
        }
        return body
    }

    // this isn't as good as the main subtitle body tooltip
    // but it's pretty close, good for now
    let popover: JpHoverTooltip | undefined
    let loadedVocab: [JpdbVocabulary, JpdbToken] | undefined
    function updateTooltip(ev: MouseEvent) {
        const showPopover = ev.shiftKey
        if (popover && !showPopover) {
            if (popover.Node.contains(ev.target as HTMLElement)) return
        }
        if (showPopover) {
            const target = ev.target as HTMLElement
            if (target.classList.contains("vocab-kanji")) {
                const vocabInfo = target.closest<HTMLElement>(".vocab-row")?.vocabInfo
                if (vocabInfo) {
                    if (loadedVocab === vocabInfo) return
                    loadedVocab = vocabInfo
                    popover ??= new JpHoverTooltip()
                    popover.Target(target, vocabInfo[0], vocabInfo[1])
                }
            }
        } else {
            loadedVocab = undefined
            popover?.Close()
        }
    }
    // would be nice to use the same events as SubtitleViewer
    // would be good to share the hovered character calculation, since I assume it's not super cheap
    // would add a shared event handler, similar to onDeath
    body.addEventListener("mousemove", updateTooltip)

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
                <CheckboxField label="Ignored" onChange={v => {
                    showIgnored = v
                    reload()
                }} />
                <CheckboxField label="Kana" onChange={v => {
                    showKana = v
                    reload()
                }} />
                <CheckboxField label="N+1" onChange={v => {
                    n1 = v
                    reload()
                }} />
                <CheckboxField label="Trim Kana" checked={trimKana} onChange={v => {
                    trimKana = v
                    setSetting("miningTrimKana", v)
                    reload()
                }} />
                <CheckboxField label="Chronological" checked={chronological} onChange={v => {
                    chronological = v
                    setSetting("miningChronological", v)
                    reload()
                }} />
                <NumberField label="Max Frequency" min={0} defaultValue={maxFrequency} baseChange={1000} onChange={v => {
                    maxFrequency = v
                    setSetting("miningMaxFrequency", v)
                    reload()
                }} />
                <NumberField label="Max Count" min={0} defaultValue={maxCount} baseChange={10} onChange={v => {
                    maxCount = v
                    setSetting("miningMaxRecommendedCount", v)
                    reload()
                }} />
            </div>
            {body}
        </>,
        id: "recommended-mining-modal",
        getMinimizeTarget: getMinimizeTarget,
        onClose: () => ClearEventHandler("vocab-mined", mineHandler)
    })
    RegisterEventHandler("vocab-mined", mineHandler)
    return res
} 