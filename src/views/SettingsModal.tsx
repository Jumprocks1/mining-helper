import NumberField from "../components/basic/NumberField"
import Loader from "../components/Loader"
import { OpenModal } from "../components/Modal"
import RegexReplacements from "./RegexReplacements"

interface FieldProps<T> {
    key: SettingsKeys
}

// resets on page load
interface TemporarySettings {
    offset: number
}

const temporarySettings: TemporarySettings = {
    offset: 0
}

type SettingsKeys = keyof TemporarySettings

const listeners: { key: string, listener: (v: any) => void }[] = []

export function onSettingChange<K extends SettingsKeys>(key: K, listener: (v: TemporarySettings[K]) => void) {
    listeners.push({ key, listener })
}

export function getSetting<K extends SettingsKeys>(key: K): TemporarySettings[K] {
    return temporarySettings[key]
}
export function setSetting<K extends SettingsKeys>(key: K, v: TemporarySettings[K]) {
    if (temporarySettings[key] === v) return
    temporarySettings[key] = v
    for (const listener of listeners) {
        if (listener.key === key)
            listener.listener(v)
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
        </div>
    }} />

    return OpenModal({
        header: "Settings",
        body,
        id: "settings-modal"
    })
}