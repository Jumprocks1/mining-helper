import { getAnkiWords } from "../anki/CardList";
import IconButton from "../components/basic/IconButton";
import Loader from "../components/Loader";
import { OpenModal } from "../components/Modal";
import { getVocabState, VocabState } from "../jpdb/JpdbParseText";
import { Subtitles } from "../utils/srt";

export default (subtitles: Subtitles) => {
    const jpdb = subtitles.jpdbParse
    if (!jpdb) return

    const body = <Loader load={async () => {
        const body = <></>
        await getAnkiWords()
        const sorted = jpdb.vocabulary.toSorted((a, b) => a[2] - b[2])
        for (let i = 0; i < sorted.length; i++) {
            if (body.childElementCount >= 50) break
            const vocab = sorted[i]
            const state = getVocabState(vocab)
            if (state !== VocabState.New) continue
            body.append(<div className="vocab-row">
                <IconButton icon="delete" title="Ignore" />
                <span>{vocab[2]} - {vocab[0]} - {vocab[3][0]}</span>
            </div>)
        }
        return body
    }} />


    const res = OpenModal({
        header: "Recommended Vocab",
        body,
        id: "recommended-mining-modal"
    })
    return res
} 