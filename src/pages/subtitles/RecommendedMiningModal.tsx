import { getAnkiFurigana } from "../anki/CardList";
import CheckboxField from "../../components/basic/CheckboxField";
import IconButton from "../../components/basic/IconButton";
import NumberField from "../../components/basic/NumberField";
import UpDownButtons from "../../components/basic/UpDownButtons";
import Loader from "../../components/Loader";
import { OpenModal } from "../../components/Modal";
import { IgnoreVid, loadIgnoreList, UnIgnoreVid } from "../../jpdb/IgnoreList";
import { JpdbParseResponse, JpdbToken, JpdbVocabulary } from "../../jpdb/JpdbParseText";
import { geti1Tokens, getVocabState, getVocabStateAndNote, VocabState, VocabStateConfig } from "../../jpdb/JpdbState";
import { tryPlayAudio } from "../../utils/Audio";
import { ClearEventHandler, RegisterEventHandler } from "../../utils/Events";
import { Subtitles } from "../../utils/srt";
import { CardData } from "../../utils/util";
import { RegisterJpHoverTooltip } from "./JpHoverTooltip";
import { UpdateTooltip } from "../../framework/Tooltips";
import { getSetting, setSetting, getDefaultSetting } from "../../core/Settings";

interface RecommendedMiningModalProps {
    jpdb: JpdbParseResponse
    seekTo: (token: JpdbToken) => void
    seekToNext?: (tokens: JpdbToken[], down: boolean) => void
    subtitles?: Subtitles // used for i1 tokens
}

export default async (getMinimizeTarget: () => DOMRect | undefined, props: RecommendedMiningModalProps) => {
    const jpdb = props.jpdb

    let maxCountElement: HTMLElement

    let showIgnored = false
    let showKana = false
    let i1 = false
    const pending = [getSetting("miningTrimKana"), getSetting("miningChronological"), getSetting("miningMaxFrequency"), getSetting("miningMaxRecommendedCount")] as const
    let trimKana = await pending[0]
    let chronological = await pending[1]
    let maxFrequency = await pending[2]
    let maxCount = await pending[3]

    const body = <table className="row-container" />
    let loadedCount = 0

    const load = async () => {
        const body = <></>
        await getAnkiFurigana()
        await loadIgnoreList()

        const stateConfig: VocabStateConfig = {
            trimKana,
            kanaUnknown: showKana
        }

        const i1Ids = i1 && props.subtitles && geti1Tokens(props.subtitles, jpdb, stateConfig)

        const sorted = jpdb.vocabulary.toSorted((a, b) => (a[2] ?? Number.MAX_SAFE_INTEGER) - (b[2] ?? Number.MAX_SAFE_INTEGER))
            // We use < instead of <= so if the max is set to 10000, you don't get 9999 and 10000 (which are different lengths)
            .filter(e => (e[2] ?? Number.MAX_SAFE_INTEGER) < maxFrequency)
        const pendingRows: [JpdbVocabulary, HTMLElement, firstUsage: JpdbToken][] = []
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
            let tokenUsages: JpdbToken[]
            if (i1Ids) {
                const found = i1Ids.get(vocab[5])
                if (!found) continue
                tokenUsages = found
            } else {
                tokenUsages = []
                for (const token of jpdb.tokens) {
                    const v = jpdb.vocabulary[token[3]]
                    if (v === vocab) tokenUsages.push(token)
                }
            }
            const makeDeleteButton = () => <IconButton icon={ignored ? "restore_from_trash" : "delete"}
                title={ignored ? "Restore" : "Ignore" + "\nHold shift to ignore for 30 days\nUseful for names/locations."}
                onClick={async ev => {
                    if (ignored) {
                        ignored = false
                        await UnIgnoreVid(vocab)
                        row.classList.remove("ignored")
                        row.classList.remove("temporarilyignored")
                    } else {
                        ignored = true
                        await IgnoreVid(vocab, ev.shiftKey)
                        row.classList.add("ignored")
                        if (ev.shiftKey)
                            row.classList.add("temporarilyignored")
                    }
                    // this is sketchy, but works
                    deleteButton.replaceWith(deleteButton = makeDeleteButton())
                }} />
            let deleteButton = makeDeleteButton()
            const row = <tr className="vocab-row">
                <td><div>{deleteButton}</div></td>
                <td className="frequency"><div>{vocab[2] ?? "N/A"}</div></td>
                <td><div>
                    <UpDownButtons onClick={(_, down) => {
                        if (props.seekToNext) props.seekToNext(tokenUsages, down)
                        else {
                            if (keyboardState?.vocab !== vocab) keyboardState = { vocab, tokenUsages }
                            if (keyboardState.index === undefined) {
                                keyboardState.index = down ? 0 : tokenUsages.length - 1
                            } else {
                                keyboardState.index = Math.max(Math.min(keyboardState.index + (down ? 1 : -1), tokenUsages.length - 1), 0)
                            }
                            props.seekTo(keyboardState.tokenUsages[keyboardState.index])
                        }
                        row.focus()
                    }}>
                        <span className="usage-count">{tokenUsages.length}</span>
                    </UpDownButtons>
                </div></td>
                <td><div>
                    <IconButton icon="play_arrow" onClick={() => {
                        row.focus()
                        return tryPlayAudio(vocab)
                    }} />
                </div></td>
                <td className="grow-column"><div><span><span className="vocab-kanji">{vocab[0]}</span> - {vocab[3][0]}</span></div></td>
            </tr>
            row.vocab = vocab // for tooltip
            row.tokenUsages = tokenUsages
            if (originalState === VocabState.Ignored) row.classList.add("ignored")
            if (originalState === VocabState.TemporarilyIgnored) row.classList.add("temporarilyignored")
            if (state === VocabState.Kana) row.classList.add("kana")
            pendingRows.push([vocab, row, tokenUsages[0]])
        }
        if (chronological) pendingRows.sort((a, b) => a[2][0] - b[2][0])
        for (const [_, row] of pendingRows) {
            row.tabIndex = -1
            body.append(row)
        }
        loadedCount = pendingRows.length
        UpdateTooltip(maxCountElement)
        return body
    }


    let keyboardState: { vocab: JpdbVocabulary, tokenUsages: JpdbToken[], index?: number } | undefined = undefined
    function updateKeyboardState(up: boolean): true | undefined {
        const focusRow = document.activeElement?.closest<HTMLElement>(".vocab-row")
        if (!focusRow || !body.contains(focusRow)) return
        const vocab = focusRow?.vocab
        if (!vocab) return
        if (vocab === keyboardState?.vocab && keyboardState.index !== undefined) {
            keyboardState.index = keyboardState.index + (up ? -1 : 1)
            if (keyboardState.index >= 0 && keyboardState.index < keyboardState.tokenUsages.length)
                return true
        }
        const next = (up ? focusRow.previousElementSibling : focusRow.nextElementSibling) as HTMLElement | null
        if (next?.vocab) {
            const tokenUsages = next.tokenUsages
            if (!tokenUsages) return
            keyboardState = { vocab: next.vocab, tokenUsages, index: up ? tokenUsages.length - 1 : 0 }
            next.focus()
            return true
        }
        keyboardState = undefined
    }
    body.addEventListener("keydown", ev => {
        if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
            ev.preventDefault()
            ev.stopPropagation()
            const valid = updateKeyboardState(ev.key === "ArrowUp")
            if (!keyboardState || keyboardState.index === undefined || !valid) return
            props.seekTo(keyboardState.tokenUsages[keyboardState.index])
        }
    })


    RegisterJpHoverTooltip({
        body, invert: false,
        getTargetAndVocab: hovered => {
            const kanji = (hovered[0].parentElement as HTMLElement).closest(".vocab-kanji") as HTMLElement
            if (!kanji) return
            const vocab = kanji.closest<HTMLElement>(".vocab-row")?.vocab
            if (!vocab) return
            return [kanji, vocab]
        }
    })

    const reload = () => {
        body.replaceChildren(<Loader load={load} />)
    }
    reload()

    function mineHandler(card: CardData) {
        const v = card.vocab;
        if (!v) return
        for (const row of body.querySelectorAll<HTMLElement>(".vocab-row")) {
            const rv = row.vocab
            if (rv && rv.furigana === v.furigana && rv[0] === v[0]) {
                row.classList.add("known")
            }
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
                {/* i+1 not supported for reader page yet */}
                {props.subtitles && <CheckboxField label="i+1" tooltip={() =>
                    `Filters vocab to subtitle entries with only 1 new vocab in them.\n\nSomewhat limited because:\n`
                    + `1. Names often count as unknown vocab, despite not having a relevant meaning.\n`
                    + `2. More than a single subtitle entry is often needed for context.`}
                    onChange={v => {
                        i1 = v
                        reload()
                    }} />}
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
                    extraTooltip={() => "\nCurrently showing: " + loadedCount} />}
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
