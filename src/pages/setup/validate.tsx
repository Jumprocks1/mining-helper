import { Icon } from "../../components/basic/IconButton"
import { callJpdb } from "../../jpdb/JpdbParseText"
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
    const runningRow = <div className="row"><span className="loading-icon" />Running checks...</div>
    const output = <div className="validation-result">
        {runningRow}
    </div>
    validateButton.tooltip = output
    try {
        const resp = await serverPost("validate")
        const json = await resp.json() as ValidateResponse
        if (json.error) throw json.userMessage
        if (json.connected) output.append(<div className="row">{CheckIcon()}Server connected</div>)
        else output.append(<div className="warning">Server not connected</div>)
        if (!json.ffmpegFound) {
            output.append(<div className="warning">
                ffmpeg not found. Please place it in the system path or in the `lib` folder next to appsettings.json
            </div>)
        } else {
            output.append(<div className="row">
                {CheckIcon()}ffmpeg found
            </div>)
        }
    } catch (e) {
        if (String(e).includes("Failed to fetch"))
            throw userErrorMessage(`Please make sure the server is running.\nFull error:\n${String(e)}`,
                `Failed to connect to ${await getSetting("serverAddress")}`)
        throw userErrorMessage(e, "Error connecting to server")
    }
    await validateJpdb(output)
    runningRow.remove()
}

export async function validateJpdb(output: HTMLElement) {
    const setError = async (message: string) => {
        output.append(<div className="row">
            {<Icon icon="error" className="error" />}
            {message}
        </div>)
    }

    const apiKey = await getSetting("jpdbApiKey")
    if (!apiKey?.trim()) return setError("No jpdb API key set")

    const resp = await callJpdb("ping", {})
    if (resp.error === "bad_key") return setError("Invalid jpdb API key")

    output.append(<div className="row">
        {CheckIcon()}Connected to jpdb.io
    </div>)
}