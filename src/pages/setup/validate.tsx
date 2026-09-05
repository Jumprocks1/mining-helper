import Loader from "../../components/Loader"
import { callJpdb } from "../../jpdb/JpdbParseText"
import { serverPost } from "../../utils/Audio"
import { getHttpServerAddress } from "../../utils/httpServerUtil"
import MpvWebSocket from "../../utils/MpvWebSocket"
import SettingsValidator from "../../utils/SettingsValidator"
import { userErrorMessage } from "../../utils/UserError"
import { JpdbApiKeyField } from "../../views/SettingsFields"
import { getSetting, stringSettingsField } from "../../views/SettingsModal"

export interface ValidateResponse {
    ffmpegFound?: boolean
    connected?: boolean
    pipe?: boolean
    mpvFound?: boolean
    mpvScriptFound?: boolean

    error?: string
    errorMessage?: string
    userMessage?: string
}

interface PingResponse {
    success: boolean
    allowOrigin: boolean
    origin: string
}
// intetionally doesn't send API key
export async function serverPing() {
    const serverAddress = await getSetting("serverAddress")
    const httpServer = `http://${serverAddress}/ping`
    const resp = await fetch(httpServer, { method: "GET" })
    const json = await resp.json() as PingResponse
    return json
}

export async function validateSettings(validateButton: HTMLElement) {
    const tester = new SettingsValidator()
    tester.ShowLoading = true
    validateButton.tooltip = tester.Node
    await tester.Test(async () => {
        await validateJpdb(tester, false)
        await validateServerConnection(tester, false)
    })
}

export async function validateJpdb(tester: SettingsValidator, showField: boolean) {
    tester.Section("jpdb")
    const setError = async (message: string) => {
        tester.ErrorIcon(message)
        if (showField) tester.AppendOutput(await JpdbApiKeyField())
    }

    const apiKey = await getSetting("jpdbApiKey")
    if (!apiKey?.trim()) {
        if (showField)
            return setError("Missing jpdb API key, please add one below")
        else
            return setError("Missing jpdb API key")
    }

    const resp = await callJpdb("ping", {})
    if (resp.error === "bad_key") {
        if (showField)
            return setError("Invalid jpdb API key, please set one below")
        else
            return setError("Invalid jpdb API key")
    }

    tester.Pass("Connected to jpdb.io")
}

export async function validateServerConnection(tester: SettingsValidator, showField: boolean) {
    tester.Section("Server")
    // TODO check what bad origin looks like
    try {
        // TODO we probably don't really need this call
        //   we intentionally aren't setting the API key for this call and are only looking if fetch throws an exception
        //   Instead, we could probably rely on serverPost("validate") throwing an exception
        await fetch(await getHttpServerAddress(), { method: "GET" })
    } catch {
        const res = <div>
            Failed to connect to {await getHttpServerAddress()}.{"\n"}
            Please ensure the Mining Helper server is running.{"\n"}
            This connection is required in order to communicate with mpv.{"\n"}
            {"\n"}
            To setup the server, download it <a target="_blank" rel="noopener noreferrer"
                className="colored"
                href="https://github.com/Jumprocks1/mining-helper/releases">from GitHub</a>.{"\n"}
            Once downloaded, unzip and run "setup.bat".{"\n"}
            For manual setup instructions, see <a target="_blank" rel="noopener noreferrer"
                className="colored"
                href="https://github.com/Jumprocks1/mining-helper/blob/main/docs/SETUP.md">SETUP.md</a>.{"\n"}
            Once complete, check your settings again.
        </div>
        throw res
    }
    try {
        const resp = await serverPost("validate")
        const json = await resp.json() as ValidateResponse
        if (json.error) {
            if (json.error === "missing-key" || json.error === "bad-key") {
                tester.ErrorIcon(json.userMessage)
                tester.AppendOutput(<div>
                    To get your API key, run setup.bat and copy the key from the output.
                    {showField && <Loader load={() => stringSettingsField("serverApiKey", "Server API Key", "password")} />}
                </div>)
                return
            }
            throw json.userMessage
        }
        if (json.connected) tester.Pass("Server connected")
        else tester.Warn("Server not connected")

        if (!json.ffmpegFound) {
            tester.Warn("ffmpeg not found. Please place it in the system path or in the `lib` folder next to appsettings.json")
        } else {
            tester.Pass("ffmpeg found")
        }
        if (!json.pipe) {
            tester.Warn("mpv IPC pipe not connected - please make sure you started the server through the mpv script")
        } else {
            tester.Pass("mpv IPC pipe connected")
        }
        if (!json.mpvFound) {
            tester.Warn("mpv folder not found - this is fine if everything else is working. Otherwise, please install mpv")
        } else {
            if (json.mpvScriptFound) {
                tester.Pass("mpv script found")
            } else {
                tester.Warn("mpv script not found - please place `mining_helper.lua` in your mpv scripts folder")
            }
        }

        const websocket = new MpvWebSocket()
        await websocket.Connect()
        if (websocket.Open) {
            tester.Pass("WebSocket connected")
        } else {
            throw "WebSocket connection failed. Check server logs."
        }
        websocket.Close()
    } catch (e) {
        if (String(e).includes("Failed to fetch"))
            throw userErrorMessage(`Please make sure the server is running.\nFull error:\n${String(e)}`,
                `Failed to connect to ${await getSetting("serverAddress")}`)
        throw userErrorMessage(e, "Error connecting to server")
    }
}