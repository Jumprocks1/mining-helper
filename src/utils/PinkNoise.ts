// This doesn't really belong, but I wanted it for when I was reading, so here it is

import { homeUrl } from "../framework/Router";

let context: AudioContext | undefined
let pinkNoise: AudioNode | undefined

export default async () => {
    if (pinkNoise && context) {
        pinkNoise.disconnect()
        pinkNoise = undefined
        return
    }
    context ??= new AudioContext();
    // Not sure what needs this
    // if (audioContext.state === "suspended")
    //     await audioContext.resume();
    await context.audioWorklet.addModule(`${homeUrl()}/js/PinkNoise.js`);
    // Stereo is actually pretty nice
    const worklet = new AudioWorkletNode(context, "pink-noise-processor", { outputChannelCount: [2] })
    const gain = context.createGain()
    gain.gain.value = 5 / 100 // TODO add control
    pinkNoise = worklet.connect(gain)
    pinkNoise.connect(context.destination)
}