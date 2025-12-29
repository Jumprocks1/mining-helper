import { JpdbToken, JpdbVocabulary } from "../jpdb/JpdbParseText"
import type { SubtitlesPage } from "../subtitles/subtitles"
import { getSubsInRange, getTokenFor } from "../subtitles/SubtitleUtil"
import { saveToAnkiAndRemove } from "../utils/AnkiUtil"
import { getAudio, getAudioOptionsFromKanji, playAudio, tryGetAudioBytes } from "../utils/Audio"
import { type Children } from "../framework/createElement"
import { getOrCreatePendingCard } from "../utils/MiningUtil"
import MpvWebSocket from "../utils/MpvWebSocket"
import { formatTimestamp, parseSrt, SubtitleEntry, SubtitleEntryWithCharacterOffset, Subtitles } from "../utils/srt"
import UserError from "../utils/UserError"
import { cleanSource, furiFromToken, furiToReading, jpdbEntryUrl, lookupFuri, tokensToFuri } from "../utils/util"
import { applyRegexTo } from "../views/RegexReplacements"
import AudioButton from "./AudioButton"
import { HtmlPopover } from "./basic/HtmlPopover"
import IconButton from "./basic/IconButton"
import NumberField from "./basic/NumberField"
import UpDownButtons from "./basic/UpDownButtons"
import Loader from "./Loader"
import LoadingButton from "./LoadingButton"
import { Modal } from "./Modal"

interface Props {
    word: string
    onClose: () => void
    token?: JpdbToken
    entry: SubtitleEntryWithCharacterOffset
    subtitles: Subtitles // for finding adjacent entries and vocab lookups
    mpv?: MpvWebSocket
    startIndex?: number // index inside of entry.text, not always available
    endIndex?: number
    subtitlesPage: SubtitlesPage
}

let englishFailed = false

async function tryLoadEnglish(subtitles: Subtitles, mpv: MpvWebSocket | undefined) {
    if (subtitles.translated || !mpv || englishFailed) return subtitles.translated
    try {
        const subs = await mpv.RequestIfOpen("english-subs")
        if (typeof subs === "string") throw new Error()
        const decoded = new TextDecoder().decode(subs)
        return subtitles.translated = await parseSrt(decoded)
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
    const { entry, mpv, subtitles, startIndex, endIndex } = props
    const jpdb = subtitles.jpdbParse
    let token: JpdbToken | undefined = undefined

    if (jpdb && startIndex !== undefined && endIndex !== undefined) {
        token = getTokenFor(subtitles, startIndex + entry.characterOffset, endIndex + entry.characterOffset)
        if (token) {
            const start = token[0] - entry.characterOffset
            word = entry.text.substring(start, start + token[1])
        }
    }

    async function getSentenceCeInnerHTML(entry: SubtitleEntry) {
        // don't remember why I don't do the space replacement with regex
        return (await applyRegexTo(entry.text, true)).replace("　", " ").replaceAll(word, "<b>" + word + "</b>")
    }

    const sourceFile = cleanSource(filenameFromPath(props.subtitlesPage.currentFilename))

    async function body() {
        const entries = subtitles.processedEntries

        const card = await getOrCreatePendingCard(word, true)

        let vocab: JpdbVocabulary | undefined

        if (jpdb && token) {
            vocab = jpdb.vocabulary[token[3]]
            card.kanji = vocab[0]
            card.meaning = vocab[3][0]
            // prefer better audio over jpdb audio
            if (!card.audioLocalFile || card.audioLocalFile.includes("jpdb")) {
                card.audioBytes = await tryGetAudioBytes(vocab)
                if (card.audioBytes) card.audioLocalFile = `${card.kanji}_auto.mp3`
            }
            if (!card.furigana)
                card.furigana = furiFromToken(vocab[0], token)
        }


        const kanji = card.kanji // this can be different if word is a verb

        async function save() {
            card.jpSentenceKanji = sentenceCE.innerText.replace("\n", " ");

            const meaning = meaningCE.innerText
            if (!meaning) throw new UserError("Meaning missing")
            if (!card.audioBytes) throw new UserError("Missing word audio")
            if (vocab) card.vid = vocab[5]
            card.meaning = meaning

            // could load this from tokens, but it's tricky since user can modify it
            // this is fine for now
            card.jpSentenceFuri = await lookupFuri(card.jpSentenceKanji, word)
            card.jpSentenceKanji = card.jpSentenceKanji.replace(word, "<b>" + word + "</b>")

            card.enSentence = sentenceMeaningCE.textContent

            if (sourceFile) card.source = sourceFile + "/t/" + (startTime + startOffset) / 1000

            await saveToAnkiAndRemove(card, "mining-modal")
            modal.Close()
        }

        const labeled: HTMLElement[] = []
        function add(label: Children, el: Children) {
            labeled.push(<div className="field">
                <div className="label">{label}</div>
                <div className="field-value">{el}</div>
            </div>)
        }

        const meaningCE = <div contentEditable="plaintext-only" />
        const sentenceCE = <div contentEditable="plaintext-only" />

        sentenceCE.innerHTML = await getSentenceCeInnerHTML(entry);
        add("Kanji", kanji)
        add("Reading", card.furigana ?? "N/A")

        const menuPopover = new HtmlPopover({
            className: "menu",
            hydrate: async () => {
                const options = await getAudioOptionsFromKanji(kanji, furiToReading(card.furigana))
                return options.map(e => <div className="audio-entry-option"
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
        const menuButton = <IconButton icon="menu" /> as HTMLButtonElement
        menuButton.popoverTargetElement = menuPopover.Node
        menuButton.popoverTargetAction = "toggle"

        labeled.push(<div className="field">
            <div className="label">Word Audio{menuButton}</div>
            {menuPopover}
            <div className="field-value">
                {AudioButton({ audio: () => card.audioBytes, name: kanji })}
            </div>
        </div>)

        if (card.meaning) {
            meaningCE.innerText = card.meaning
            add("Meaning", meaningCE)
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
                    sentenceCE.innerHTML += "\n" + await getSentenceCeInnerHTML(newEntry)
                } else {
                    if (firstEntryIndex === 0) return
                    firstEntryIndex -= 1
                    const newEntry = entries[firstEntryIndex]
                    sentenceCE.innerHTML = await getSentenceCeInnerHTML(newEntry) + "\n" + sentenceCE.innerHTML
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
        labeled.push(<div className="field">
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


        let startOffset = 0
        let endOffset = 0
        let loadedOffsets: [number, number] | undefined = undefined

        const playButtonPlaceholder = <div></div>

        const timeField = <span></span>
        function updateTimeField() {
            const timestamp = formatTimestamp(startTime, 1)
            const duration = endTime - startTime
            timeField.innerText = timestamp + " + " + (duration / 1000).toFixed(1) + "s"
        }
        updateTimeField()
        labeled.push(<div className="field time-field">
            <label>Time</label>
            <div className="field-value">
                {timeField}
                <NumberField onChange={v => startOffset = v} defaultValue={startOffset} label="Start" showPlus />
                <NumberField onChange={v => endOffset = v} defaultValue={endOffset} label="End" showPlus />
                {playButtonPlaceholder}
            </div>
        </div>)

        let mpvPromise: Promise<string | Uint8Array<ArrayBuffer>> | undefined = undefined

        async function loadMpvAudio() {
            if (!mpv) return
            const so = startOffset
            const eo = endOffset
            mpvPromise = mpv.RequestIfOpen(`mpv-audio:${startTime + so}-${endTime + eo}`)
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
            playButtonPlaceholder.replaceChildren(Loader({ load: loadedButton.then(e => typeof e === "string" ? e : e.button) }))
            return loadedButton
        }
        loadMpvAudio()

        // I don't like this
        modal.Node.querySelector(".inner-modal")!.append(<div className="footer">
            <LoadingButton onClick={save} loading={mpvPromise}>Save</LoadingButton>
        </div>)
        return labeled
    }

    const modal = new Modal({
        body,
        header: <><span>Mining <b>{word}</b></span>{sourceFile && <span className="source">{sourceFile}</span>}</>,
        onClose: props.onClose,
        id: "mining-modal"
    });
    return modal
}