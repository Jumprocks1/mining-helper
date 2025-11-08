import { getAnkiWords } from "../anki/CardList";
import IconButton from "../components/basic/IconButton";
import Loader from "../components/Loader";
import { OpenModal } from "../components/Modal";
import { IgnoreVid, loadIgnoreList } from "../jpdb/IgnoreList";
import { getVocabState, JpdbVocabulary, VocabState } from "../jpdb/JpdbParseText";
import { playAudio } from "../utils/Audio";
import { Subtitles } from "../utils/srt";

async function tryPlayAudio(vocab: JpdbVocabulary) {
    const kanji = vocab[0]
    const audioBytes = await fetch("http://127.0.0.1:8080", { method: "POST", body: `audio-bytes-kanji:${kanji}` })
    if (!audioBytes.ok) return
    const buffer = await audioBytes.arrayBuffer()
    await playAudio(kanji, buffer)
}

export default (subtitles: Subtitles) => {
    const jpdb = subtitles.jpdbParse
    if (!jpdb) return

    const body = <Loader load={async () => {
        const body = <></>
        await getAnkiWords()
        await loadIgnoreList()
        const sorted = jpdb.vocabulary.toSorted((a, b) => a[2] - b[2])
        for (let i = 0; i < sorted.length; i++) {
            if (body.childElementCount >= 50) break
            const vocab = sorted[i]
            const state = getVocabState(vocab)
            if (state !== VocabState.New) continue
            const row = <div className="vocab-row">
                <IconButton icon="delete" title="Ignore" onClick={async () => {
                    await IgnoreVid(vocab[5])
                    row.remove()
                }} />
                {vocab[2]}
                {" -"}
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
        id: "recommended-mining-modal"
    })
    return res
} 