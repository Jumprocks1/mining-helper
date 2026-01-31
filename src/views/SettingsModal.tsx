import NumberField from "../components/basic/NumberField"
import Loader from "../components/Loader"
import { OpenModal } from "../components/Modal"
import AnkiSettingsModal from "../pages/anki/AnkiSettingsModal"
import AdvancedSettingsModal from "./AdvancedSettingsModal"
import RegexReplacements, { ReplacementEntry } from "./RegexReplacements"

type Milliseconds = number
type KeysOfType<T, V> = {
    [K in keyof T]: T[K] extends V ? K : never
}[keyof T]

// resets on page load
interface TemporarySettings {
    offset: Milliseconds
}

export const AnkiFieldsDefaults = {
    word: "Word",
    wordReading: "Word Reading",
    wordMeaning: "Word Meaning",
    wordFurigana: "Word Furigana",
    sentence: "Sentence",
    sentenceMeaning: "Sentence Meaning",
    sentenceFurigana: "Sentence Furigana",
    jpdbVid: "Jpdb Vid",
    source: "Source",
    wordAudio: "Word Audio",
    sentenceAudio: "Sentence Audio",
    image: "Image",
} as const

export type AnkiFieldKey = keyof typeof AnkiFieldsDefaults

interface LocalSettings {
    regexReplacements: ReplacementEntry[]
    skipChapterRegex: string
    customCss: string

    miningMaxFrequency: number
    miningMaxRecommendedCount: number
    miningTrimKana: boolean
    miningChronological: boolean

    serverAddress: string
    serverApiKey: string
    jpdbApiKey: string

    targetAnkiDeck: string,
    targetAnkiModel: string,
    ankiConnectAddress: string
    ankiConnectApiKey: string
    ankiFields: { [key in AnkiFieldKey]?: string }

    volume: number

    defaultStartOffset: Milliseconds
    defaultEndOffset: Milliseconds

    defaultTooltipDelay: Milliseconds
}

export const defaultLocalSettings: LocalSettings = {
    regexReplacements: [],

    serverAddress: "127.0.0.1:4012",
    serverApiKey: "",
    jpdbApiKey: "",

    targetAnkiDeck: "",
    targetAnkiModel: "",
    ankiConnectAddress: "http://127.0.0.1:8765",
    ankiConnectApiKey: "",
    ankiFields: {},

    skipChapterRegex: "",
    customCss: "",
    miningMaxRecommendedCount: 50,
    miningMaxFrequency: 20_000,
    miningTrimKana: true,
    miningChronological: false,
    volume: 0.6,
    defaultStartOffset: 0,
    defaultEndOffset: 100,

    defaultTooltipDelay: 300
}

const syncSettings = ["defaultTooltipDelay"] satisfies (keyof LocalSettings)[]
const cachedSettings: { [key in keyof LocalSettings]?: LocalSettings[key] } & TemporarySettings = {
    offset: 0
}
type SyncSettingsKey = keyof TemporarySettings | (typeof syncSettings)[number]
type AllSettings = LocalSettings & TemporarySettings
export type SettingsKey = keyof TemporarySettings | keyof LocalSettings

const listeners: { key: string, listener: (v: any) => void }[] = []

export function onSettingChange<K extends SettingsKey>(key: K, listener: (v: AllSettings[K]) => void) {
    listeners.push({ key, listener })
}
export function removeOnSettingChange<K extends SettingsKey>(key: K, listener: (v: AllSettings[K]) => void) {
    for (let i = listeners.length - 1; i >= 0; i--) {
        if (listeners[i].key === key && listeners[i].listener === listener) {
            listeners.splice(i, 1)
        }
    }
}

export function getSettingSync<K extends SyncSettingsKey>(key: K) {
    if (key in cachedSettings)
        return cachedSettings[key]
    // @ts-expect-error
    return defaultLocalSettings[key]
}

export function getSetting<K extends keyof TemporarySettings>(key: K): TemporarySettings[K];
export function getSetting<K extends keyof LocalSettings>(key: K): Promise<LocalSettings[K]>;
export function getSetting<K extends SettingsKey>(key: K): AllSettings[K] | Promise<AllSettings[K]> {
    if (key in cachedSettings)
        // @ts-expect-error
        return cachedSettings[key]
    if (key in defaultLocalSettings)
        return chrome.storage.local.get({ [key]: defaultLocalSettings[key as keyof LocalSettings] }).then(e => e[key])
    throw new Error()
}

// could be nice to have a promise ensuring these are loaded
for (const key of syncSettings) {
    getSetting(key).then(v => cachedSettings[key] = v)
}

export async function setSetting<K extends SettingsKey>(key: K, v: AllSettings[K]) {
    if (key in defaultLocalSettings) {
        if (key in cachedSettings && cachedSettings[key] === v) return
        cachedSettings[key] = v
        await chrome.storage.local.set({ [key]: v })
        triggerSettingChanged(key, v)
    } else if (key in cachedSettings) {
        if (cachedSettings[key] === v) return
        cachedSettings[key] = v
        triggerSettingChanged(key, v)
    }
    else throw new Error()
}
export function triggerSettingChanged<K extends SettingsKey>(key: K, v: AllSettings[K]) {
    for (const listener of listeners) {
        if (listener.key === key)
            listener.listener(v)
    }
}

function inputToVolume(input: number) {
    // technically should do some logarithms and stuff here, but this is fine
    input /= 100
    return Math.pow(input, 2)
}
function volumeToInput(volume: number) {
    return Math.round(Math.pow(volume, 1 / 2) * 100)
}
export async function stringSettingsField(key: KeysOfType<LocalSettings, string>, label: string, type?: string) {
    return <div className="field">
        <label>{label}</label>
        <input type={type} defaultValue={await getSetting(key)}
            onchange={e => setSetting(key, (e.target as HTMLInputElement).value)} />
    </div>
}

// TODO this modal should be split into extension settings vs subtitle page settings
export default () => {
    const body = <Loader load={async () => {
        let inputVolume = volumeToInput(await getSetting("volume"))
        const volumeInput = <input defaultValue={inputVolume.toString()}
            type="range" min="0" max="100" onchange={async e => {
                const input = e.target as HTMLInputElement
                inputVolume = input.valueAsNumber
                volumeInput.tooltip = `${inputVolume}%`
                return setSetting("volume", inputToVolume(input.valueAsNumber))
            }} />
        volumeInput.tooltip = `${inputVolume}%`


        return <>
            <button onclick={RegexReplacements}>Regex replacements</button>
            <div className="field">
                <label>Subtitle Offset</label>
                <NumberField showPlus units="ms" id="offset-field" baseChange={100}
                    defaultValue={getSetting("offset")} onChange={v => setSetting("offset", v)} />
            </div>
            {await stringSettingsField("skipChapterRegex", "Ignore Chapters (Regex)")}
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
            {await stringSettingsField("serverAddress", "mpv/Audio Server Address")}
            {await stringSettingsField("serverApiKey", "Server API Key", "password")}

            {await stringSettingsField("jpdbApiKey", "JPDB API Key", "password")}

            <div className="footer-buttons">
                <button onclick={() => {
                    modal.Close()
                    AnkiSettingsModal()
                }}>
                    Anki Setup
                </button>
                <button onclick={() => {
                    modal.Close()
                    AdvancedSettingsModal()
                }}>
                    Advanced Settings
                </button>
            </div>
        </>
    }} />

    const modal = OpenModal({
        header: "Settings",
        body,
        id: "settings-modal"
    })
    return modal
}