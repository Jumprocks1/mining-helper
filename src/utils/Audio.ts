import { JpdbVocabulary } from "../jpdb/JpdbParseText"
import { getSetting } from "../views/SettingsModal"
import { urlToArrayBuffer } from "./util"

let audioContext: AudioContext | undefined = undefined
let gainNode: GainNode | undefined = undefined
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
    if (gainNode === undefined) {
        gainNode = audioContext.createGain()
        gainNode.connect(audioContext.destination)
    }
    gainNode.gain.value = await getSetting("volume")
    const source = audioContext.createBufferSource();
    // audio thread needs a copy of the buffer, so we have to slice
    source.buffer = await audioContext.decodeAudioData(bytes.slice(0));
    source.connect(gainNode);

    stopAll()

    playing[name] = source
    source.onended = () => {
        source.disconnect()
        delete playing[name]
    }
    source.start(0, offset)
}


export async function serverPost(body: string) {
    const apiKey = await getSetting("serverApiKey")
    const headers: HeadersInit = {}
    if (apiKey) headers["X-Api-Key"] = apiKey
    const serverAddress = await getSetting("serverAddress")
    const httpServer = `http://${serverAddress}`
    return await fetch(httpServer, {
        method: "POST", body, headers
    })
}
export async function serverPostJson<T>(body: string) {
    const res = await serverPost(body)
    if (!res.ok) throw await res.text()
    return res.json() as T
}

export async function tryGetAudioBytes(vocab: JpdbVocabulary | string) {
    try {
        let audioBytes: Response
        if (typeof vocab === "string") {
            audioBytes = await serverPost(`audio-bytes-kanji:${vocab}`)
        } else {
            const kanji = vocab[0]
            audioBytes = await serverPost(`audio-bytes-kanji:${kanji}:${vocab[1]}`)
        }
        if (!audioBytes.ok) return
        const buffer = await audioBytes.arrayBuffer()
        return buffer.byteLength > 0 ? buffer : undefined
    } catch (e: unknown) {
        console.error(e)
        return
    }
}
export async function tryPlayAudio(vocab: JpdbVocabulary) {
    await playAudio(vocab[0], tryGetAudioBytes(vocab))
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
    const audioOptions = await serverPost(body)
    return await audioOptions.json() as AudioEntry[]
}

export async function getAudio(entry?: AudioEntry) {
    if (!entry) return
    const audioBytes = await serverPost(`audio-bytes:${entry.ID}`)
    if (!audioBytes.ok) return
    const buffer = await audioBytes.arrayBuffer()
    return buffer.byteLength > 0 ? buffer : undefined
}