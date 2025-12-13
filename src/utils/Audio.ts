import { JpdbVocabulary } from "../jpdb/JpdbParseText"
import { urlToArrayBuffer } from "./util"

let audioContext: AudioContext | undefined = undefined
let playing: Record<string, AudioBufferSourceNode> = {}


function stopAll() {
    for (const key in playing) {
        const audio = playing[key]
        audio.stop()
        // @ts-expect-error
        audio.onended?.()
        audio.onended = null
        delete playing[key]
    }
}

type PlayableAudioBase = Uint8Array<ArrayBuffer> | ArrayBuffer | undefined
export type PlayableAudio = PlayableAudioBase | Promise<PlayableAudioBase> | (() => PlayableAudioBase | Promise<PlayableAudioBase>) | string

export async function resolveAudio(audio: PlayableAudio): Promise<ArrayBuffer | undefined> {
    let loadedAudio = audio
    if (typeof loadedAudio === "string") loadedAudio = urlToArrayBuffer(loadedAudio)
    if (typeof loadedAudio === "function") loadedAudio = loadedAudio()
    if (loadedAudio && "buffer" in loadedAudio) {
        loadedAudio = loadedAudio.buffer.slice(loadedAudio.byteOffset, loadedAudio.byteOffset + loadedAudio.byteLength)
    }
    // @ts-expect-error - for some reason the type guard isn't perfect, but I think it's correct
    return await loadedAudio;
}

export async function playAudio(name: string, audio: PlayableAudio, offset: number = 0) {
    const bytes = await resolveAudio(audio)
    if (!bytes) return
    audioContext ??= new AudioContext()
    const source = audioContext.createBufferSource();
    // audio thread needs a copy of the buffer, so we have to slice
    source.buffer = await audioContext.decodeAudioData(bytes.slice(0));
    source.connect(audioContext.destination);

    stopAll()

    playing[name] = source
    source.onended = () => delete playing[name]
    source.start(0, offset)
}

export async function tryGetAudioBytes(vocab: JpdbVocabulary) {
    const kanji = vocab[0]
    const audioBytes = await fetch("http://127.0.0.1:8080", { method: "POST", body: `audio-bytes-kanji:${kanji}` })
    if (!audioBytes.ok) return
    const buffer = await audioBytes.arrayBuffer()
    return buffer
}
export async function tryPlayAudio(vocab: JpdbVocabulary) {
    const kanji = vocab[0]
    const audioBytes = await fetch("http://127.0.0.1:8080", { method: "POST", body: `audio-bytes-kanji:${kanji}:${vocab[1]}` })
    if (!audioBytes.ok) return
    const buffer = await audioBytes.arrayBuffer()
    await playAudio(kanji, buffer)
}

export interface AudioEntry {
    Source: string
    File: string
    Reading: string
    ID: number
}

export async function getAudioOptionsFromKanji(kanji: string, reading?: string) {
    let body = `lookup-audio:${kanji}`
    if (reading) body += ":" + reading
    const audioOptions = await fetch("http://127.0.0.1:8080", { method: "POST", body })
    return await audioOptions.json() as AudioEntry[]
}

export async function getAudio(entry?: AudioEntry) {
    if (!entry) return
    const audioBytes = await fetch("http://127.0.0.1:8080", { method: "POST", body: `audio-bytes:${entry.ID}` })
    if (!audioBytes.ok) return
    return await audioBytes.arrayBuffer()
}