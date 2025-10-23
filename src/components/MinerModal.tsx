import AddIcons from "../utils/AddIcons"
import { getOrCreatePendingCard } from "../utils/MiningUtil"
import MpvWebSocket from "../utils/MpvWebSocket"
import { formatTimestamp, SubtitleEntry } from "../utils/srt"
import { jpdbEntryUrl } from "../utils/util"
import AudioButton from "./AudioButton"

interface Props {
    word: string
    onClose: () => void
    entry: SubtitleEntry
    mpv?: MpvWebSocket
}

async function loadBody(props: Props, inner: HTMLElement) {
    const { word, entry, mpv } = props
    async function save() {

    }

    const card = await getOrCreatePendingCard(word)

    const labeled: HTMLElement[] = []
    function add(label: string, el: HTMLElement | string) {
        labeled.push(<div className="field">
            <label>{label}</label>
            <div className="fieldValue">{el}</div>
        </div>)
    }

    const sentence = <div />
    sentence.innerHTML = entry.text.replace(word, "<b>" + word + "</b>");
    add("Word Audio", card.audioBytes ? AudioButton({ audio: card.audioBytes, name: word }) : "N/A")
    add("Meaning", card.meaning ?? <a target="_blank" rel="noopener noreferrer" href={jpdbEntryUrl(word)}>N/A</a>)
    add("Sentence", sentence)
    const duration = entry.endTime - entry.startTime
    let timestamp = formatTimestamp(entry.startTime, 1)
    add("Time", timestamp + " + " + (duration / 1000).toFixed(1) + "s")

    if (mpv) {
        const sentenceAudio = await mpv.RequestIfOpen(`mpv-audio:${entry.startTime}-${entry.endTime}`)
        add("Sentence Audio", sentenceAudio ? AudioButton({ audio: sentenceAudio, name: word }) : "N/A")
    }

    inner.append(<div className="footer">
        <button onclick={save}>Save</button>
    </div>)
    return labeled
}

export default (props: Props) => {
    AddIcons()
    const closeButton = <span className="material-symbols-outlined icon-button close-button">close</span>

    const { word, onClose } = props

    const body = <div className="body"><div className="loader"></div></div>
    const inner = <div className="inner-modal">
        <div className="header">
            <div>Mining <b>{word}</b></div>
            {closeButton}
        </div>
        {body}
    </div>
    loadBody(props, inner).then(e => body.replaceChildren(...e))
    const res = <div className="modal">
        {inner}
    </div>
    res.onclick = ev => {
        if (ev.target === res) {
            onClose()
        }
    }
    closeButton.onclick = onClose
    return res
}