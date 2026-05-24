import { getAnkiWords } from "../../pages/anki/CardList";
import CheckboxField from "../../components/basic/CheckboxField";
import IconButton from "../../components/basic/IconButton";
import NumberField from "../../components/basic/NumberField";
import UpDownButtons from "../../components/basic/UpDownButtons";
import Loader from "../../components/Loader";
import { OpenModal } from "../../components/Modal";
import { IgnoreVid, loadIgnoreList, UnIgnoreVid } from "../../jpdb/IgnoreList";
import { JpdbToken, JpdbVocabulary } from "../../jpdb/JpdbParseText";
import { geti1Tokens, getVocabState, getVocabStateAndNote, VocabState, VocabStateConfig } from "../../jpdb/JpdbState";
import { tryPlayAudio } from "../../utils/Audio";
import { setSelection } from "../../utils/CharacterHighlighter";
import { ClearEventHandler, RegisterEventHandler } from "../../utils/Events";
import { SubtitleEntryWithCharacterOffset, Subtitles } from "../../utils/srt";
import { CardData } from "../../utils/util";
import { getDefaultSetting, getSetting, setSetting } from "../../views/SettingsModal";
import SubtitlesPage from "./subtitles";
import JpHoverTooltip from "./JpHoverTooltip";
import { UpdateTooltip } from "../../framework/Tooltips";


declare global {
    interface HTMLElement {
        vocabInfo?: [vocab: JpdbVocabulary, token: JpdbToken]
    }
}

export default async (subtitles: Subtitles, getMinimizeTarget: () => DOMRect | undefined, subtitlesPage: SubtitlesPage) => {
    if (!subtitles.jpdbParse) await subtitlesPage.TryJpdbParse();
    const jpdb = subtitles.jpdbParse
    if (!jpdb) return

    let maxCountElement: HTMLElement

    let showIgnored = false
    let showKana = false
    let i1 = false
    const pending = [getSetting("miningTrimKana"), getSetting("miningChronological"), getSetting("miningMaxFrequency"), getSetting("miningMaxRecommendedCount")] as const
    let trimKana = await pending[0]
    let chronological = await pending[1]
    let maxFrequency = await pending[2]
    let maxCount = await pending[3]

    let loadedRows: Record<number, HTMLElement> | undefined = undefined
    const body = <div className="row-container" />
    let loadedCount = 0

    const load = async () => {
        const body = <></>
        await getAnkiWords()
        await loadIgnoreList()

        const stateConfig: VocabStateConfig = {
            trimKana,
            kanaUnknown: showKana
        }

        const i1Ids = i1 && geti1Tokens(subtitles, jpdb, stateConfig)

        loadedRows = {}
        const sorted = jpdb.vocabulary.toSorted((a, b) => (a[2] ?? Number.MAX_SAFE_INTEGER) - (b[2] ?? Number.MAX_SAFE_INTEGER))
            .filter(e => (e[2] ?? Number.MAX_SAFE_INTEGER) < maxFrequency)
        const pendingRows: [JpdbVocabulary, HTMLElement, firstUsagePosition: number][] = []
        for (let i = 0; i < sorted.length; i++) {
            if (pendingRows.length >= maxCount) break
            const vocab = sorted[i]
            const originalState = getVocabState(vocab, stateConfig)
            let ignored = originalState === VocabState.Ignored || originalState === VocabState.TemporarilyIgnored
            let state = originalState

            if (showIgnored && ignored) {
                const newState = getVocabStateAndNote(vocab, {
                    ...stateConfig,
                    skipIgnoreCheck: true
                })[0]
                if (newState === VocabState.Kana)
                    state = newState
            }

            if (state !== VocabState.New) {
                if (state === VocabState.Ignored || state === VocabState.TemporarilyIgnored) { if (!showIgnored) continue }
                else if (state === VocabState.Kana) { if (!showKana) continue }
                else continue
            }
            let firstToken: JpdbToken | undefined // needed for furigana parsing on tooltip
            let tokenUsages: number[]
            if (i1Ids) {
                const found = i1Ids.get(vocab[5])
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
                title={ignored ? "Restore" : "Ignore" + "\nHold shift to ignore for 30 days\nUseful for names/locations."}
                onClick={async ev => {
                    if (ignored) {
                        ignored = false
                        await UnIgnoreVid(vocab[5])
                        row.classList.remove("ignored")
                        row.classList.remove("temporarilyignored")
                    } else {
                        ignored = true
                        await IgnoreVid(vocab[5], vocab[0], ev.shiftKey)
                        row.classList.add("ignored")
                        if (ev.shiftKey)
                            row.classList.add("temporarilyignored")
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
            if (originalState === VocabState.Ignored) row.classList.add("ignored")
            if (originalState === VocabState.TemporarilyIgnored) row.classList.add("temporarilyignored")
            if (state === VocabState.Kana) row.classList.add("kana")
            loadedRows[vocab[5]] = row
            pendingRows.push([vocab, row, tokenUsages[0]])
        }
        if (chronological) pendingRows.sort((a, b) => a[2] - b[2])
        for (const [_, row] of pendingRows) {
            body.append(row)
        }
        loadedCount = pendingRows.length
        UpdateTooltip(maxCountElement)
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
                <CheckboxField label="Kana" tooltip={`When unchecked, filters out vocab composed entirely of kana.\nTypically these are grammar or common words that aren't worth mining.`}
                    onChange={v => {
                        showKana = v
                        reload()
                    }} />
                <CheckboxField label="i+1" tooltip={() =>
                    `Filters vocab to subtitle entries with only 1 new vocab in them.\n\nSomewhat limited because:\n`
                    + `1. Names often count as unknown vocab, despite not having a relevant meaning.\n`
                    + `2. More than a single subtitle entry is often needed for context.`}
                    onChange={v => {
                        i1 = v
                        reload()
                    }} />
                <CheckboxField tooltip={() => <>
                    Trims kana before checking if a word is already mined.<br />
                    Ex:<br />
                    <em>姉</em> vs <em>お姉ちゃん</em>
                </>} label="Trim Kana" checked={trimKana} onChange={v => {
                    trimKana = v
                    setSetting("miningTrimKana", v)
                    reload()
                }} />
                <CheckboxField label="Chronological" checked={chronological} onChange={v => {
                    chronological = v
                    setSetting("miningChronological", v)
                    reload()
                }} />
                <NumberField label="Max Frequency" min={0} initialValue={maxFrequency} baseChange={1000} onChange={v => {
                    maxFrequency = v
                    setSetting("miningMaxFrequency", v)
                    reload()
                }} defaultValue={getDefaultSetting("miningMaxFrequency")} />
                {maxCountElement = <NumberField label="Max Count" min={0} initialValue={maxCount} baseChange={10} onChange={v => {
                    maxCount = v
                    setSetting("miningMaxRecommendedCount", v)
                    reload()
                }} defaultValue={getDefaultSetting("miningMaxRecommendedCount")}
                    extraTooltip={() => "\nCurrently loaded: " + loadedCount} />}
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