import NumberField from "../components/basic/NumberField";
import Loader from "../components/Loader"
import LoadingButton from "../components/LoadingButton"
import { OpenModal } from "../components/Modal"
import { JpdbCache } from "../jpdb/JpdbParseText";
import { getDefaultSetting, getSetting, setSetting } from "./SettingsModal";

async function ClearCache() {
    await JpdbCache.Clear();
}

async function customCssField() {
    const ce = <div contentEditable="plaintext-only" />
    ce.textContent = await getSetting("customCss")
    ce.addEventListener("input", async () => {
        const value = ce.textContent
        await setSetting("customCss", value)
    })
    return ce
}

export default () => {
    const body = <Loader load={async () => {
        return <>
            <div className="field">
                <div className="label">Custom CSS</div>
                <div className="field-value">{await customCssField()}</div>
            </div>
            <div className="field">
                <label>Tooltip Delay</label>
                <NumberField units="ms" baseChange={100} min={0}
                    defaultValue={getDefaultSetting("defaultTooltipDelay")}
                    initialValue={await getSetting("defaultTooltipDelay")}
                    onChange={v => setSetting("defaultTooltipDelay", v)} />
            </div>
            <div className="footer-buttons">
                <LoadingButton onClick={ClearCache}>Clear Cache</LoadingButton>
                <LoadingButton onClick={async () => {
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
        header: "Advanced Settings",
        body,
        id: "advanced-settings-modal"
    })
}