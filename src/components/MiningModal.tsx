import { JpdbToken, JpdbVocabulary } from "../jpdb/JpdbParseText"
import SubtitlesPage from "../pages/subtitles/subtitles"
import { getSubsInRange, getTokenFor } from "../pages/subtitles/SubtitleUtil"
import { saveToAnkiAndRemove } from "../utils/AnkiUtil"
import { getAudio, getAudioOptionsFromKanji, playAudio, tryGetAudioBytes } from "../utils/Audio"
import { replaceChildren, type Children } from "../framework/createElement"
import { getOrCreatePendingCard } from "../utils/MiningUtil"
import MpvWebSocket from "../utils/MpvWebSocket"
import { formatTimestamp, parseSubtitles, SubtitleEntryWithCharacterOffset, Subtitles } from "../utils/srt"
import UserError from "../utils/UserError"
import { cleanSource, furiFromToken, furiToReading, furiToRuby, jpdbEntryUrl, lookupFuri } from "../utils/util"
import AudioButton from "./AudioButton"
import IconButton, { Icon } from "./basic/IconButton"
import NumberField from "./basic/NumberField"
import UpDownButtons from "./basic/UpDownButtons"
import Loader, { Load } from "./Loader"
import LoadingButton from "./LoadingButton"
import { Modal } from "./Modal"
import { getSetting } from "../views/SettingsModal"
import DropdownMenu from "./DropdownMenu"
import { JsPopover } from "./basic/JsPopover"

interface Props {
    word: string
    onClose: () => void
    token?: JpdbToken
    entry: SubtitleEntryWithCharacterOffset
    subtitles: Subtitles // for finding adjacent entries and vocab lookups
    mpv: MpvWebSocket
    startIndex?: number // index inside of entry.text, not always available
    endIndex?: number
    subtitlesPage: SubtitlesPage
}

let englishFailed = false

async function tryLoadEnglish(subtitles: Subtitles, mpv: MpvWebSocket | undefined) {
    if (subtitles.translated || !mpv || englishFailed) return subtitles.translated
    try {
        const subs = await mpv.RequestIfOpen("english-subs")
        if (typeof subs === "string") throw new Error(subs)
        const decoded = new TextDecoder().decode(subs)
        return subtitles.translated = await parseSubtitles(decoded)
    } catch (e) {
        englishFailed = true;
        console.error("Failed to load translated subs: " + e)
    }
}


function filenameFromPath(path: string | undefined) {
    if (path) {
        const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))
        return path.substring(slash + 1)
    }
}

export default (props: Props) => {
    let word = props.word
    const { entry, subtitles, startIndex, endIndex } = props
    const mpv = props.mpv.Open ? props.mpv : undefined
    const jpdb = subtitles.jpdbParse
    let token: JpdbToken | undefined = undefined

    if (jpdb && startIndex !== undefined && endIndex !== undefined) {
        token = getTokenFor(subtitles, startIndex + entry.characterOffset, endIndex + entry.characterOffset)
        if (token) {
            const start = token[0] - entry.characterOffset
            word = entry.text.substring(start, start + token[1])
        }
    }

    function highlightWord(text: string) {
        return text.replaceAll(word, "<b>" + word + "</b>")
    }

    const sourceFile = cleanSource(filenameFromPath(props.subtitlesPage.CurrentFilename))

    async function body(inner: HTMLElement) {
        const entries = subtitles.processedEntries

        const card = await getOrCreatePendingCard(word, true)

        let vocab: JpdbVocabulary | undefined

        if (jpdb && token) {
            vocab = jpdb.vocabulary[token[3]]
            card.kanji = vocab[0]
            card.meaning = vocab[3][0]
            if (!card.audioLocalFile) {
                card.audioBytes = await tryGetAudioBytes(vocab)
                if (card.audioBytes) card.audioLocalFile = `${card.kanji}_auto.mp3`
            }
            if (!card.furigana)
                card.furigana = furiFromToken(vocab[0], token)
        } else {
            if (!card.audioLocalFile) {
                card.audioBytes = await tryGetAudioBytes(card.kanji)
                if (card.audioBytes) card.audioLocalFile = `${card.kanji}_auto.mp3`
            }
        }


        const kanji = card.kanji // this can be different if word is a verb

        async function save() {
            card.jpSentenceKanji = sentenceCE.innerText.replaceAll("\n", " ");

            const meaning = meaningCE.innerText
            if (!meaning) throw new UserError("Meaning missing")
            if (!card.audioBytes) throw new UserError("Missing word audio")
            if (vocab) card.vid = vocab[5]
            card.meaning = meaning

            // could load this from tokens, but it's tricky since user can modify it
            // this is fine for now
            card.jpSentenceFuri = await lookupFuri(card.jpSentenceKanji, word)
            card.jpSentenceKanji = highlightWord(card.jpSentenceKanji)

            card.enSentence = sentenceMeaningCE.textContent

            if (sourceFile) card.source = sourceFile + "/t/" + (startTime + startOffset) / 1000

            if (card.imageTime && mpv) {
                const image = await mpv.RequestIfOpen(`image:480:${card.imageTime}`)
                if (typeof image !== "string")
                    card.image = image
            }

            await saveToAnkiAndRemove(card, "mining-modal")
            modal.Close()
        }

        const body: HTMLElement[] = []

        if (!jpdb) {
            body.push(<div className="warning">jpdb parsing info is not loaded. Meaning and reading will not load.</div>)
        }
        if (!mpv) {
            body.push(<div className="warning">No mpv connection. Audio and sentence translation will not load.</div>)
        }

        function add(label: Children, el: Children) {
            body.push(<div className="field">
                <div className="label">{label}</div>
                <div className="field-value">{el}</div>
            </div>)
        }

        const meaningCE = <div contentEditable="plaintext-only" />
        const sentenceCE = <div contentEditable="plaintext-only" />

        sentenceCE.innerHTML = highlightWord(entry.text)

        body.push(<div className="field" id="word-field">
            <div className="label">Word</div>
            <div className="field-value"><span>{card.furigana ? furiToRuby(card.furigana) : card.kanji}</span></div>
        </div>)

        const menuButton = <IconButton icon="menu" onClick={() => menuPopover.Toggle()} /> as HTMLButtonElement
        const menuPopover = new JsPopover({
            type: "menu",
            anchor: menuButton,
            hydrate: async () => {
                const options = await getAudioOptionsFromKanji(kanji, furiToReading(card.furigana))
                return options.map(e => <div className="menu-option audio-entry-option"
                    onclick={async ev => {
                        if (ev.target !== ev.currentTarget) return
                        const audio = await getAudio(e)
                        if (!audio) return
                        card.audioBytes = audio
                        playAudio(kanji, card.audioBytes)
                        menuPopover.Close()
                    }}>
                    <AudioButton name={kanji} audio={() => getAudio(e)} />
                    {e.Source}
                </div>)
            }
        })

        body.push(<div className="field">
            <div className="label">Word Audio{menuButton}</div>
            <div className="field-value">
                {card.audioBytes ? AudioButton({ audio: () => card.audioBytes, name: kanji })
                    : <Icon className="error" icon="error"
                        tooltip={`No audio found for ${kanji}`} />}
            </div>
        </div>)

        if (card.meaning) {
            meaningCE.innerText = card.meaning
            add(<>Meaning
                {vocab && vocab[3].length > 1 &&
                    <DropdownMenu options={vocab[3].map((e, i) => ({ meaning: e, node: `${i + 1}. ${e}` }))}
                        onSelect={e => meaningCE.innerText = card.meaning = e.meaning} />}
            </>, meaningCE)
        } else {
            add("Meaning", <a target="_blank" rel="noopener noreferrer" href={jpdbEntryUrl(kanji)}>N/A</a>)
        }
        let firstEntryIndex = entries.indexOf(entry)
        let lastEntryIndex = firstEntryIndex // not exclusive, unlike most things

        let startTime = entry.startTime
        let endTime = entry.endTime

        let uneditedMeaningCE = ""
        function setMeaningCE(s: string, onlyIfUnchanged: boolean) {
            if (onlyIfUnchanged &&
                (uneditedMeaningCE !== sentenceMeaningCE.textContent
                    && sentenceMeaningCE.textContent.trim() !== "")) return
            sentenceMeaningCE.textContent = uneditedMeaningCE = s
        }

        add(<>
            Sentence
            {firstEntryIndex !== -1 && <UpDownButtons onClick={async (_, down) => {
                if (down) {
                    if (lastEntryIndex === entries.length - 1) return
                    lastEntryIndex += 1
                    const newEntry = entries[lastEntryIndex]
                    sentenceCE.innerHTML += "\n" + highlightWord(newEntry.text)
                } else {
                    if (firstEntryIndex === 0) return
                    firstEntryIndex -= 1
                    const newEntry = entries[firstEntryIndex]
                    sentenceCE.innerHTML = highlightWord(newEntry.text) + "\n" + sentenceCE.innerHTML
                }
                startTime = entries[firstEntryIndex].startTime
                endTime = entries[lastEntryIndex].endTime
                if (subtitles.translated)
                    setMeaningCE(getSubsInRange(subtitles.translated.originalEntries, startTime, endTime), true)
                updateTimeField()
                await loadMpvAudio()
            }} />}
        </>, sentenceCE)

        const sentenceMeaningCE = <div contentEditable="plaintext-only" /> as HTMLDivElement
        body.push(<div className="field">
            <label>Sentence Meaning</label>
            <div className="field-value">
                <Loader load={async () => {
                    const english = await tryLoadEnglish(subtitles, mpv)
                    if (english) {
                        setMeaningCE(getSubsInRange(english.originalEntries, startTime, endTime), false)
                    }
                    return sentenceMeaningCE
                }} />
            </div>
        </div>)


        const defaultStartOffset = await getSetting("defaultStartOffset")
        const defaultEndOffset = await getSetting("defaultEndOffset")
        let startOffset = defaultStartOffset
        let endOffset = defaultEndOffset
        let loadedOffsets: [number, number] | undefined = undefined

        const playButtonPlaceholder = <div></div>

        const timeField = <span></span>
        function updateTimeField() {
            const timestamp = formatTimestamp(startTime, 1)
            const duration = endTime - startTime
            timeField.innerText = timestamp + " + " + (duration / 1000).toFixed(1) + "s"
        }
        updateTimeField()
        body.push(<div className="field time-field">
            <label>Time</label>
            <div className="field-value">
                {timeField}
                <NumberField onChange={v => startOffset = v} defaultValue={defaultStartOffset} label="Start" baseChange={100} showPlus
                    storeDefault="defaultStartOffset" />
                <NumberField onChange={v => endOffset = v} defaultValue={defaultEndOffset} label="End" baseChange={100} showPlus
                    storeDefault="defaultEndOffset" />
                {playButtonPlaceholder}
            </div>
        </div>)

        let mpvPromise: Promise<string | Uint8Array<ArrayBuffer>> | undefined = undefined

        function loadMpvAudio() {
            if (!mpv) return
            const so = startOffset
            const eo = endOffset
            mpvPromise = mpv.RequestIfOpen(`mpv-audio:${startTime + so}-${endTime + eo}`)
            if (!mpvPromise) return
            const loadedButton = mpvPromise.then(sentenceAudio => {
                if (typeof sentenceAudio === "string") return "Failed to load"
                const buffer = sentenceAudio.buffer.slice(sentenceAudio.byteOffset, sentenceAudio.byteOffset + sentenceAudio.byteLength)
                card.sentenceAudioBytes = buffer
                card.sentenceAudioLocalFile = `${card.kanji}_ex_mpv.ogg`
                card.sentenceIndex = "mpv"
                loadedOffsets = [so, eo]
                const click = async (ev: PointerEvent) => {
                    if (!loadedOffsets) return
                    if (startOffset !== loadedOffsets[0] || endOffset !== loadedOffsets[1]) {
                        const reloaded = await loadMpvAudio()
                        if (typeof reloaded === "object") reloaded.click(ev)
                    } else {
                        const startAt = ev.ctrlKey ? Math.max(0, (endTime + eo - (startTime + so) - 1000) / 1000) : undefined
                        playAudio(kanji + "_ex", buffer, startAt)
                    }
                }
                return {
                    button: <IconButton className="play-icon" icon="play_arrow" onClick={click} />,
                    click
                }
            })
            replaceChildren(playButtonPlaceholder, Load(loadedButton.then(e => typeof e === "string" ? e : e.button)))
            return loadedButton
        }
        loadMpvAudio()

        if (mpv) {
            async function loadImages() {
                if (!mpv) return
                imageField.querySelectorAll(".image-container").forEach(e => e.remove())
                const container = <div className="image-container" />
                let placeholders: HTMLElement[] = []
                for (let i = 0; i < 3; i++) {
                    const placeholder = <div className="loading-image" />
                    placeholders.push(placeholder)
                    container.append(placeholder)
                }
                imageField.append(container)
                let i = 0;
                async function addOption(t: number) {
                    if (!mpv) return
                    // parameter is vertical resolution
                    const image = await mpv.RequestIfOpen(`image:150:${t}`)
                    if (!image || typeof image === "string") return
                    const url = URL.createObjectURL(new Blob([image]))
                    modal.RegisterOnClose(() => URL.revokeObjectURL(url))
                    const img = <img src={url} onclick={() => {
                        container.querySelectorAll("img").forEach(e => e.classList.remove("selected"))
                        img.classList.add("selected")
                        card.imageTime = t
                    }} />
                    placeholders[i++].replaceWith(img)
                }
                await addOption(startTime + startOffset)
                await addOption(Math.round((startTime + startOffset + endTime + endOffset) / 2))
                await addOption(endTime + endOffset)
            }
            const imageField = <div className="field image-field">
                <div className="label">Image <IconButton icon="add" onClick={loadImages} /></div>
            </div>
            body.push(imageField)
        }

        inner.append(<div className="footer">
            <LoadingButton onClick={save} loading={mpvPromise}
                tooltip={"Creates a new Anki card"}>Save</LoadingButton>
        </div>)
        return body
    }

    const modal = new Modal({
        body,
        header: <><span>Mining <b>{word}</b></span>{sourceFile && <span className="source">{sourceFile}</span>}</>,
        onClose: props.onClose,
        id: "mining-modal"
    });
    return modal
}