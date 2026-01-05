import NumberField from "../components/basic/NumberField"
import Loader from "../components/Loader"
import LoadingButton from "../components/LoadingButton"
import { OpenModal } from "../components/Modal"
import { JpdbCache } from "../jpdb/JpdbParseText"
import RegexReplacements, { ReplacementEntry } from "./RegexReplacements"

type Milliseconds = number

// resets on page load
interface TemporarySettings {
    offset: Milliseconds
}

interface LocalSettings {
    regexReplacements: ReplacementEntry[]
    // don't use undefined here, doesn't play well with chrome storage `get`
    ankiConnectKey: string | null
    skipChapterRegex: string

    miningMaxFrequency: number
    miningTrimKana: boolean
    miningChronological: boolean
    serverApiKey: string | null
    serverAddress: string,
    volume: number

    // ms
    defaultStartOffset: Milliseconds
    defaultEndOffset: Milliseconds
}

const defaultLocalSettings: LocalSettings = {
    regexReplacements: [],
    ankiConnectKey: null,
    serverApiKey: null,
    serverAddress: "127.0.0.1:4012",
    skipChapterRegex: "",
    miningMaxFrequency: 50_000,
    miningTrimKana: true,
    miningChronological: false,
    volume: 0.6,
    defaultStartOffset: 0,
    defaultEndOffset: 100
}

const temporarySettings: TemporarySettings = {
    offset: 0
}

type AllSettings = LocalSettings & TemporarySettings
type SettingsKeys = keyof TemporarySettings | keyof LocalSettings

const listeners: { key: string, listener: (v: any) => void }[] = []

export function onSettingChange<K extends SettingsKeys>(key: K, listener: (v: AllSettings[K]) => void) {
    listeners.push({ key, listener })
}

export function getSetting<K extends keyof TemporarySettings>(key: K): TemporarySettings[K];
export function getSetting<K extends keyof LocalSettings>(key: K): Promise<LocalSettings[K]>;
export function getSetting<K extends SettingsKeys>(key: K): AllSettings[K] | Promise<AllSettings[K]> {
    if (key in temporarySettings)
        return temporarySettings[key as keyof TemporarySettings] as AllSettings[K]
    if (key in defaultLocalSettings)
        return chrome.storage.local.get({ [key]: defaultLocalSettings[key as keyof LocalSettings] }).then(e => e[key])
    throw new Error()
}
export async function setSetting<K extends SettingsKeys>(key: K, v: AllSettings[K]) {
    if (key in temporarySettings) {
        if (temporarySettings[key as keyof TemporarySettings] as AllSettings[K] === v) return
        // @ts-expect-error
        temporarySettings[key] = v
        triggerSettingChanged(key, v)
    } else if (key in defaultLocalSettings) {
        await chrome.storage.local.set({ [key]: v })
        triggerSettingChanged(key, v)
    }
    else throw new Error()
}
export function triggerSettingChanged<K extends SettingsKeys>(key: K, v: AllSettings[K]) {
    for (const listener of listeners) {
        if (listener.key === key)
            listener.listener(v)
    }
}

async function ClearCache() {
    await JpdbCache.Clear();
}

function inputToVolume(input: number) {
    // technically should do some logarithms and stuff here, but this is fine
    input /= 100
    return Math.pow(input, 2)
}
function volumeToInput(volume: number) {
    return Math.round(Math.pow(volume, 1 / 2) * 100)
}

// TODO this modal should be split into extension settings vs subtitle page settings
export default () => {
    const body = <Loader load={async () => {
        let inputVolume = volumeToInput(await getSetting("volume"))
        const volumeInput = <input defaultValue={inputVolume.toString()}
            type="range" min="0" max="100" onchange={async e => {
                const input = e.target as HTMLInputElement
                inputVolume = input.valueAsNumber
                volumeInput.dataset.tooltip = `${inputVolume}%`
                return setSetting("volume", inputToVolume(input.valueAsNumber))
            }} />
        volumeInput.dataset.tooltip = `${inputVolume}%`
        return <>
            <button className="list-button" onclick={RegexReplacements}>Regex replacements</button>
            <div className="field">
                <label>Offset</label>
                <NumberField showPlus units="ms" id="offset-field"
                    defaultValue={getSetting("offset")} onChange={v => setSetting("offset", v)} />
            </div>
            <div className="field">
                <label htmlFor="chapter-regex">Ignore Chapters (Regex)</label>
                <input id="chapter-regex" defaultValue={await getSetting("skipChapterRegex")} onchange={async e => {
                    const input = e.target as HTMLInputElement
                    return setSetting("skipChapterRegex", input.value)
                }} />
            </div>
            <div className="field">
                <label>Volume</label>
                {volumeInput}
            </div>
            <div className="field">
                <label>Default Mining Offsets</label>
                <div id="mining-offset-row">
                    <NumberField label="Start" baseChange={100} showPlus
                        onChange={v => setSetting("defaultStartOffset", v)} defaultValue={await getSetting("defaultStartOffset")}
                        units="ms" />
                    <NumberField label="End" baseChange={100} showPlus
                        onChange={v => setSetting("defaultEndOffset", v)} defaultValue={await getSetting("defaultEndOffset")}
                        units="ms" />
                </div>
            </div>
            <div className="footer-buttons">
                <LoadingButton className="list-button" onClick={ClearCache}>Clear Cache</LoadingButton>
                <LoadingButton className="list-button" onClick={async () => {
                    const used = await chrome.storage.local.getBytesInUse()
                    console.log(`Using ${used} bytes (${Math.round(used / chrome.storage.local.QUOTA_BYTES * 100)}%)`)
                    console.log(await chrome.storage.local.get())
                }}>
                    Log Storage
                </LoadingButton>
            </div>
        </>
    }} />

    return OpenModal({
        header: "Settings",
        body,
        id: "settings-modal"
    })
}