import Loader from "../components/Loader"
import LoadingButton from "../components/LoadingButton"
import { OpenModal } from "../components/Modal"
import { JpdbCache } from "../jpdb/JpdbParseText";

async function ClearCache() {
    await JpdbCache.Clear();
}

export default () => {
    const body = <Loader load={async () => {
        return <>
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