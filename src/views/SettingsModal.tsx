import NumberField from "../components/basic/NumberField"
import Loader from "../components/Loader"
import LoadingButton from "../components/LoadingButton"
import { OpenModal } from "../components/Modal"
import RegexReplacements, { ReplacementEntry } from "./RegexReplacements"

interface FieldProps<T> {
    key: { [K in SettingsKeys]: AllSettings[K] extends T ? K : never }[SettingsKeys]
}

// resets on page load
interface TemporarySettings {
    offset: number
}

interface LocalSettings {
    regexReplacements: ReplacementEntry[]
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

export function getSetting<K extends SettingsKeys>(key: K): AllSettings[K] {
    if (key in temporarySettings)
        return temporarySettings[key as keyof TemporarySettings] as AllSettings[K]
    throw new Error()
}
export function setSetting<K extends SettingsKeys>(key: K, v: AllSettings[K]) {
    if (key in temporarySettings) {
        if (temporarySettings[key as keyof TemporarySettings] as AllSettings[K] === v) return
        // @ts-expect-error
        temporarySettings[key] = v
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
    const keys = await chrome.storage.local.getKeys()
    for (const key of keys) {
        if (key.startsWith("jpdb_cache_")) {
            await chrome.storage.local.remove(key)
        }
    }
}

export default () => {
    async function numberField(props: FieldProps<number>) {
        const defaultValue = getSetting(props.key)
        return <div className="setting-row field">
            <label htmlFor="offset">Offset</label>
            <NumberField defaultValue={defaultValue} onChange={v => setSetting("offset", v)} showPlus />
        </div>
    }

    const body = <Loader load={async () => {
        return <div className="list">
            <button className="list-button" onclick={RegexReplacements}>Regex replacements</button>
            {await numberField({ key: "offset" })}
            <LoadingButton className="list-button" onClick={ClearCache}>Clear Cache</LoadingButton>
        </div>
    }} />

    return OpenModal({
        header: "Settings",
        body,
        id: "settings-modal"
    })
}