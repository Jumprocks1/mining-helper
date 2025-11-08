import { getAnkiWords } from "../anki/CardList";
import IconButton from "../components/basic/IconButton";
import UpDownButtons from "../components/basic/UpDownButtons";
import Loader from "../components/Loader";
import { OpenModal } from "../components/Modal";
import { IgnoreVid, loadIgnoreList } from "../jpdb/IgnoreList";
import { getVocabState, JpdbVocabulary, VocabState } from "../jpdb/JpdbParseText";
import { playAudio } from "../utils/Audio";
import { SubtitleEntry, Subtitles } from "../utils/srt";
import { getCurrentMpvTime, seekToNextEntry, seekToSubtitle } from "./subtitles";

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
                {vocab[2]}
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
        id: "recommended-mining-modal"
    })
    return res
} 