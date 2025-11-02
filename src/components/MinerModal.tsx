import { saveToAnkiAndRemove } from "../utils/AnkiUtil"
import { getOrCreatePendingCard, saveCard } from "../utils/MiningUtil"
import MpvWebSocket from "../utils/MpvWebSocket"
import { formatTimestamp, SubtitleEntry } from "../utils/srt"
import { jpdbEntryUrl, lookupFuri } from "../utils/util"
import AudioButton from "./AudioButton"
import IconButton from "./basic/IconButton"
import NumberField from "./basic/NumberField"
import Loader from "./Loader"
import LoadingButton from "./LoadingButton"
import { Modal } from "./Modal"

interface Props {
    word: string
    onClose: () => void
    entry: SubtitleEntry
    mpv?: MpvWebSocket
}

export default (props: Props) => {
    const { word } = props

    async function body(inner: HTMLElement) {
        const { word, entry, mpv } = props
        const card = await getOrCreatePendingCard(word, true)
        const kanji = card.kanji // this can be different if word is a verb

        async function save() {
            card.jpSentenceKanji = entry.text.replace("\n", " ").replace("　", " ");
            // TODO pull from eng subs. Choose subs that have >50% overlap with the JP sub (based on their own durations)
            // TODO allow setting english manually for now, don't worry about pulling from subs
            card.enSentence = undefined

            card.jpSentenceFuri = await lookupFuri(card.jpSentenceKanji, word)
            card.jpSentenceKanji = card.jpSentenceKanji.replace(word, "<b>" + word + "</b>")

            const sentenceMeaning = sentenceMeaningInput.value
            if (sentenceMeaning) card.enSentence = sentenceMeaning

            await saveToAnkiAndRemove(card)
            modal.Close()
        }

        const labeled: HTMLElement[] = []
        function add(label: string, el: HTMLElement | string) {
            labeled.push(<div className="field">
                <label>{label}</label>
                <div className="field-value">{el}</div>
            </div>)
        }

        const sentence = <div />
        sentence.innerHTML = entry.text.replace(word, "<b>" + word + "</b>");
        add("Kanji", kanji)
        add("Reading", card.furigana ?? "N/A")
        add("Word Audio", card.audioBytes ? AudioButton({ audio: card.audioBytes, name: kanji }) : "N/A")
        add("Meaning", card.meaning ?? <a target="_blank" rel="noopener noreferrer" href={jpdbEntryUrl(kanji)}>N/A</a>)
        add("Sentence", sentence)
        const sentenceMeaningInput = <input /> as HTMLInputElement
        labeled.push(<div className="field">
            <label>Sentence Meaning</label>
            {sentenceMeaningInput}
        </div>)


        let startOffset = 0
        let endOffset = 0

        const duration = entry.endTime - entry.startTime

        let timestamp = formatTimestamp(entry.startTime, 1)
        labeled.push(<div className="field time-field">
            <label>Time</label>
            <div className="field-value">
                {timestamp + " + " + (duration / 1000).toFixed(1) + "s"}
                <NumberField onChange={v => startOffset = v} defaultValue={startOffset} label="Start" showPlus />
                <NumberField onChange={v => endOffset = v} defaultValue={endOffset} label="End" showPlus />
                <IconButton icon="refresh" onClick={() => {
                    // TODO refresh the mpv promise
                }} />
            </div>
        </div>)


        let mpvPromise: Promise<string | Uint8Array<ArrayBuffer>> | undefined = undefined

        if (mpv) {
            mpvPromise = mpv.RequestIfOpen(`mpv-audio:${entry.startTime}-${entry.endTime + endOffset}`)
            add("Sentence Audio", Loader({
                // sadly this makes the layout shift, not sure of a good way around it
                load: mpvPromise.then(sentenceAudio => {
                    if (typeof sentenceAudio !== "string") {
                        const buffer = sentenceAudio.buffer.slice(sentenceAudio.byteOffset, sentenceAudio.byteOffset + sentenceAudio.byteLength)
                        card.sentenceAudioBytes = buffer
                        card.sentenceAudioLocalFile = `${card.kanji}_ex_mpv.ogg`
                        card.sentenceIndex = "mpv"
                        return AudioButton({ audio: buffer, name: kanji + "_ex" })
                    } else return "Failed to load"
                })
            }))
        }

        inner.append(<div className="footer">
            <LoadingButton onClick={save} loading={mpvPromise}>Save</LoadingButton>
        </div>)
        return labeled
    }

    const modal = new Modal({
        body,
        header: <div>Mining <b>{word}</b></div>,
        onClose: props.onClose
    });
    modal.Node.classList.add("miner-modal")
    return modal
}