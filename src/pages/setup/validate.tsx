import { Icon } from "../../components/basic/IconButton"
import { serverPost } from "../../utils/Audio"
import { userErrorMessage } from "../../utils/UserError"
import { getSetting } from "../../views/SettingsModal"

interface ValidateResponse {
    ffmpegFound?: boolean
    connected?: boolean

    error?: string
    errorMessage?: string
    userMessage?: string
}

export function CheckIcon() {
    return <Icon icon="check" className="check" />
}

export async function validateSettings(validateButton: HTMLElement) {
    validateButton.tooltip = undefined
    let success = <div className="validation-result" />
    try {
        const resp = await serverPost("validate")
        const json = await resp.json() as ValidateResponse
        if (json.error) throw json.userMessage
        if (json.connected) success.append(<div className="row">{CheckIcon()} Server connected</div>)
        else success.append(<div className="warning">Server not connected</div>)
        if (!json.ffmpegFound) {
            success.append(<div className="warning">
                ffmpeg not found. Please place it in the system path or in the `lib` folder next to appsettings.json
            </div>)
        } else {
            success.append(<div className="row">
                {CheckIcon()} ffmpeg found
            </div>)
        }
    } catch (e) {
        if (String(e).includes("Failed to fetch"))
            throw userErrorMessage(`Please make sure the server is running.\nFull error:\n${String(e)}`,
                `Failed to connect to ${await getSetting("serverAddress")}`)
        throw userErrorMessage(e, "Error connecting to server")
    }
    validateButton.tooltip = success
}