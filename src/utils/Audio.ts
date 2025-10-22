import { urlToArrayBuffer } from "./util"

let audioContext: AudioContext | undefined = undefined
let playing: Record<string, AudioBufferSourceNode> = {}


function stopAll() {
    for (const key in playing) {
        playing[key].stop()
        delete playing[key]
    }
}

export type PlayableAudio = ArrayBuffer | Promise<ArrayBuffer | undefined> | (() => ArrayBuffer | Promise<ArrayBuffer>) | string | undefined

export async function resolveAudio(audio: PlayableAudio): Promise<ArrayBuffer | undefined> {
    let loadedAudio = audio
    if (typeof loadedAudio === "string") loadedAudio = urlToArrayBuffer(loadedAudio)
    if (typeof loadedAudio === "function") loadedAudio = loadedAudio()
    return await loadedAudio;
}

export async function playAudio(name: string, audio: PlayableAudio) {
    if (playing[name]) return
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
    source.start()
}