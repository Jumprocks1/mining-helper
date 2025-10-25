import AddIcons from "../utils/AddIcons"
import { saveToAnkiAndRemove } from "../utils/AnkiUtil"
import { getOrCreatePendingCard, saveCard } from "../utils/MiningUtil"
import MpvWebSocket from "../utils/MpvWebSocket"
import { formatTimestamp, SubtitleEntry } from "../utils/srt"
import { jpdbEntryUrl, lookupFuri } from "../utils/util"
import AudioButton from "./AudioButton"
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

            await saveToAnkiAndRemove(card)
            modal.Close()
        }

        const labeled: HTMLElement[] = []
        function add(label: string, el: HTMLElement | string) {
            labeled.push(<div className="field">
                <label>{label}</label>
                <div className="fieldValue">{el}</div>
            </div>)
        }

        const sentence = <div />
        sentence.innerHTML = entry.text.replace(word, "<b>" + word + "</b>");
        add("Kanji", kanji)
        add("Reading", card.furigana ?? "N/A")
        add("Word Audio", card.audioBytes ? AudioButton({ audio: card.audioBytes, name: kanji }) : "N/A")
        add("Meaning", card.meaning ?? <a target="_blank" rel="noopener noreferrer" href={jpdbEntryUrl(kanji)}>N/A</a>)
        add("Sentence", sentence)
        const duration = entry.endTime - entry.startTime
        let timestamp = formatTimestamp(entry.startTime, 1)
        add("Time", timestamp + " + " + (duration / 1000).toFixed(1) + "s")

        // TODO configure
        const endOffset = 0

        if (mpv) {
            const sentenceAudio = await mpv.RequestIfOpen(`mpv-audio:${entry.startTime}-${entry.endTime + endOffset}`)
            if (typeof sentenceAudio !== "string") {
                const buffer = sentenceAudio.buffer.slice(sentenceAudio.byteOffset, sentenceAudio.byteOffset + sentenceAudio.byteLength)
                card.sentenceAudioBytes = buffer
                card.sentenceAudioLocalFile = `${card.kanji}_ex_mpv.ogg`
                card.sentenceIndex = "mpv"
                add("Sentence Audio", AudioButton({ audio: buffer, name: kanji + "_ex" }))
            }
        }

        inner.append(<div className="footer">
            {/* Could make this a loading button */}
            <button onclick={save}>Save</button>
        </div>)
        return labeled
    }

    const modal = new Modal({
        body,
        header: <div>Mining <b>{word}</b></div>,
        onClose: props.onClose
    });
    return modal
}