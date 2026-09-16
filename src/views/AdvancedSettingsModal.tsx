import { Icon } from "../components/basic/IconButton";
import NumberField from "../components/basic/NumberField";
import Loader from "../components/Loader"
import LoadingButton from "../components/LoadingButton"
import { OpenModal } from "../components/Modal"
import { getSetting, setSetting, getDefaultSetting } from "../core/Settings";
import { CurrentPage } from "../framework/Router";
import { JitenCache } from "../jiten/JitenParseText";
import { JpdbCache } from "../jpdb/JpdbParseText";
import SubtitlesPage from "../pages/subtitles/subtitles";
import { BrowserStorage } from "../utils/BrowserApi";

async function ClearCache() {
    await JpdbCache.Clear();
    await JitenCache.Clear()
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
                <div className="field-value monospace">{await customCssField()}</div>
            </div>
            <div className="field">
                <label>Ignore ASS Style (Regex)<Icon icon="info" tooltip={() => {
                    let res = "Each subtitle entry in a .ass file has a style associated with it."
                        + "\nSome files use different styles for things like signs, songs, dialouge, translation, or notes."
                    const currentPage = CurrentPage()
                    if (currentPage instanceof SubtitlesPage) {
                        const subs = currentPage.LoadedSubtitles?.subtitles
                        if (subs && subs.styles && subs.styles.length > 0) {
                            res += "\nThe current file has the following styles:\n"
                                + subs.styles.join("\n")
                        }
                    }
                    return res
                }} /></label>
                <input defaultValue={await getSetting("skipAssStyleRegex")}
                    onchange={e => setSetting("skipAssStyleRegex", (e.target as HTMLInputElement).value)} />
            </div>
            <div className="field">
                <label>Tooltip Delay</label>
                <NumberField units="ms" baseChange={100} min={0}
                    defaultValue={getDefaultSetting("defaultTooltipDelay")}
                    initialValue={await getSetting("defaultTooltipDelay")}
                    onChange={v => setSetting("defaultTooltipDelay", v)} />
            </div>
            <div className="field">
                <label>Jiten API Key{" "}<Icon icon="help"
                    component="a"
                    componentProps={{
                        href: "https://jiten.moe/settings",
                        target: "_blank",
                        rel: "noopener noreferrer"
                    }}
                    className="inline"
                    tooltip={"You can get one from the very bottom of the jiten.moe settings page.\nAn account is required.\nClick to open jiten.moe"} /></label>
                <input defaultValue={await getSetting("jitenApiKey")}
                    type="password"
                    onchange={e => setSetting("jitenApiKey", (e.target as HTMLInputElement).value)} />
            </div>
            <div className="footer-buttons">
                <LoadingButton onClick={ClearCache}>Clear Cache</LoadingButton>
                <LoadingButton tooltip="Hold Ctrl to try loading JSON from your clipboard" onClick={async ev => {
                    if (ev.ctrlKey) {
                        ev.preventDefault()
                        const text = await navigator.clipboard.readText();
                        const json = JSON.parse(text)
                        await BrowserStorage.local.set(json)
                        return
                    }
                    if (BrowserStorage.local.getBytesInUse) {
                        const used = await BrowserStorage.local.getBytesInUse()
                        console.log(`Using ${used} bytes (${Math.round(used / BrowserStorage.local.QUOTA_BYTES * 100)}%)`)
                    }
                    const data = await BrowserStorage.local.get()
                    for (const key in data) {
                        if (key.startsWith(JpdbCache.Prefix)) delete data[key]
                    }
                    console.log(data)
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