import AddIcons from "../utils/AddIcons"
import { SubtitleEntry } from "../utils/srt"

interface Props {
    word: string
    onClose: () => void
    entry: SubtitleEntry
}

export default ({ word, onClose, entry }: Props) => {
    AddIcons()
    const closeButton = <span className="material-symbols-outlined icon-button close-button">close</span>
    const body = <div className="body" />
    body.innerHTML = entry.text.replace(word, "<b>" + word + "</b>")
    const res = <div className="modal">
        <div className="inner-modal">
            <div className="header">
                <div>Mining <b>{word}</b></div>
                {closeButton}
            </div>
            {body}
        </div>
    </div>
    res.onclick = ev => {
        if (ev.target === res) {
            onClose()
        }
    }
    closeButton.onclick = onClose
    return res
}