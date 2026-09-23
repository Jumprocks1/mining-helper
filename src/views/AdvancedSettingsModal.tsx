import IconButton, { Icon } from "../components/basic/IconButton";
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
                <div className="monospace">{await customCssField()}</div>
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
                <label htmlFor="jitenApiKey">Jiten API Key{" "}<Icon icon="help"
                    component="a"
                    componentProps={{
                        href: "https://jiten.moe/settings",
                        target: "_blank",
                        rel: "noopener noreferrer"
                    }}
                    className="inline"
                    tooltip={"You can get one from the very bottom of the jiten.moe settings page.\nAn account is required.\nClick to open jiten.moe"} />
                    <label className="checkbox-switch" tooltip="When green, will prefer Jiten over jpdb.io">
                        <input type="checkbox" defaultChecked={await getSetting("preferJitenApi")}
                            onchange={ev => setSetting("preferJitenApi", (ev.target as HTMLInputElement).checked)} />
                    </label>
                </label>
                <input id="jitenApiKey" defaultValue={await getSetting("jitenApiKey")}
                    type="password"
                    onchange={e => setSetting("jitenApiKey", (e.target as HTMLInputElement).value)} />
            </div>
            {await mouseButtonField()}
            <div className="footer-buttons">
                <LoadingButton onClick={ClearCache}>Clear Cache</LoadingButton>
                <LoadingButton tooltip={"Saves storage to clipboard.\n"
                    + "Also cleans/migrates storage.\nHold Ctrl to load from your clipboard instead"}
                    onClick={async ev => {
                        await migrate()
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
                        console.log(data)
                        await navigator.clipboard.writeText(JSON.stringify(data))
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

async function migrate() {
    const keys = await BrowserStorage.local.getKeys()
    for (const key of keys) {
        if (key.startsWith("jpdb_cache_"))
            await BrowserStorage.local.remove(key)
    }
}


const mouseButtonField = async () => {
    const input = <input oncontextmenu={() => false}
        defaultValue={(await getSetting("jpTooltipMouse"))?.toString() ?? ""} onmousedown={async ev => {
            ev.preventDefault()
            input.value = ev.button.toString()
            await setSetting("jpTooltipMouse", ev.button as 0 | 1 | 2 | 3 | 4)
        }} onmouseup={e => e.preventDefault()} /> as HTMLInputElement
    return <div className="field" tooltip={"Shows tooltip info for underlined vocab when pressing this mouse button.\n" +
        "Defaults to unbound.\n" +
        "Useful for reading without using the keyboard."}>
        <label className="no-stretch">Hover Tooltip Mouse Button <IconButton onClick={() => {
            input.value = ""
            setSetting("jpTooltipMouse", -1)
        }} icon="close" /></label>
        {input}
    </div>
}