import { getAnkiWords } from "../anki/CardList";
import IconButton from "../components/basic/IconButton";
import UpDownButtons from "../components/basic/UpDownButtons";
import Loader from "../components/Loader";
import { OpenModal } from "../components/Modal";
import { IgnoreVid, loadIgnoreList } from "../jpdb/IgnoreList";
import { getVocabState, VocabState } from "../jpdb/JpdbParseText";
import { tryPlayAudio } from "../utils/Audio";
import { SubtitleEntry, Subtitles } from "../utils/srt";
import { seekToNextEntry } from "./subtitles";
// TODO ^ this import is really dangerous

export default (subtitles: Subtitles) => {
    const jpdb = subtitles.jpdbParse
    if (!jpdb) return

    const body = <Loader load={async () => {
        const body = <></>
        await getAnkiWords()
        await loadIgnoreList()
        const sorted = jpdb.vocabulary.toSorted((a, b) => (a[2] ?? Number.MAX_SAFE_INTEGER) - (b[2] ?? Number.MAX_SAFE_INTEGER))
        for (let i = 0; i < sorted.length; i++) {
            if (body.childElementCount >= 50) break
            const vocab = sorted[i]
            const state = getVocabState(vocab)
            if (state !== VocabState.New) continue
            const tokenUsages: number[] = []
            for (const token of jpdb.tokens) {
                const v = jpdb.vocabulary[token[3]]
                if (v === vocab) tokenUsages.push(token[0])
            }
            const row = <div className="vocab-row">
                <IconButton icon="delete" title="Ignore" onClick={async () => {
                    await IgnoreVid(vocab[5])
                    row.remove()
                }} />
                {vocab[2] ?? "N/A"}
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
            body.append(row)
        }
        return body
    }} />


    const res = OpenModal({
        header: "Recommended Vocab",
        body,
        id: "recommended-mining-modal",
        allowMinimize: true
    })
    return res
} 