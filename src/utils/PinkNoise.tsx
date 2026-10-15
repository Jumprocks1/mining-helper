// This doesn't really belong, but I wanted it for when I was reading, so here it is

import Loader from "../components/Loader";
import { OpenModal } from "../components/Modal";
import { getSetting, onSettingChange, removeOnSettingChange, setSetting } from "../core/Settings";
import { homeUrl } from "../framework/Router";
import { inputToVolume, volumeToInput } from "../views/SettingsModal";
import { getAudioContext } from "./Audio";

export interface PinkNoiseConfig {
    volume: number
}


let pinkNoise: AudioNode | undefined
let muter: GainNode | undefined // keep at 0/1
let gain: GainNode | undefined

function update(config: PinkNoiseConfig) {
    if (!gain) return
    const context = gain.context
    if (gain.gain.value !== config.volume) {
        gain.gain.cancelScheduledValues(context.currentTime)
        if (config.volume === 0)
            gain.gain.linearRampToValueAtTime(config.volume, context.currentTime + 0.5)
        else {
            if (gain.gain.value === 0) gain.gain.value = 0.001
            gain.gain.exponentialRampToValueAtTime(config.volume, context.currentTime + 0.5)
        }
    }
}

export default async () => {
    if (pinkNoise) {
        removeOnSettingChange("pinkNoise", update)
        pinkNoise.disconnect()
        pinkNoise = undefined
        return
    }
    const context = getAudioContext()
    // Not sure what needs this
    // if (context.state === "suspended")
    //     await context.resume();
    const config = await getSetting("pinkNoise")

    await context.audioWorklet.addModule(`${homeUrl()}/js/PinkNoise.js`);
    // Stereo is actually pretty nice
    const worklet = new AudioWorkletNode(context, "pink-noise-processor", { outputChannelCount: [2] })
    gain = context.createGain()
    const now = context.currentTime
    const targetVolume = config.volume
    gain.gain.value = targetVolume / 10
    gain.gain.exponentialRampToValueAtTime(targetVolume, now + 3)
    muter = context.createGain()
    pinkNoise = worklet.connect(gain).connect(muter)
    pinkNoise.connect(context.destination)

    onSettingChange("pinkNoise", update)
}

export function mutePinkNoiseDuring(audio: AudioBufferSourceNode) {
    const m = muter
    if (!m) return
    m.gain.exponentialRampToValueAtTime(0.9, m.context.currentTime + 0.2)
    audio.addEventListener("ended", () => m.gain.exponentialRampToValueAtTime(1, m.context.currentTime + 5))
}

export function ConfigurePinkNoise() {
    const body = <Loader load={async () => {
        const config = await getSetting("pinkNoise")

        let inputVolume = volumeToInput(config.volume)
        const volumeInput = <input defaultValue={inputVolume.toString()}
            type="range" min="0" max="100" oninput={async e => {
                const input = e.target as HTMLInputElement
                inputVolume = input.valueAsNumber
                volumeInput.tooltip = `${inputVolume}%`
                config.volume = inputToVolume(input.valueAsNumber)
                return setSetting("pinkNoise", config)
            }} />
        volumeInput.tooltip = `${inputVolume}%`

        return <>
            <div className="modal-body">
                <div className="field">
                    <label>Volume</label>
                    {volumeInput}
                </div>
            </div>
        </>
    }} />

    const modal = OpenModal({
        header: "Configure Pink Noise",
        body,
        id: "pink-noise-settings-modal"
    })
    return modal
}