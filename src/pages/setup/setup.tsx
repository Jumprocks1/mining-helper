import { Icon } from "../../components/basic/IconButton"
import LoadingButton from "../../components/LoadingButton"
import { Children, replaceChildren } from "../../framework/createElement"
import { PageComponent } from "../../framework/PageComponent"
import { callJpdb } from "../../jpdb/JpdbParseText"
import { serverPost } from "../../utils/Audio"
import { getHttpServerAddress } from "../../utils/httpServerUtil"
import MpvWebSocket from "../../utils/MpvWebSocket"
import { userErrorMessage } from "../../utils/UserError"
import { JpdbApiKeyField } from "../../views/SettingsFields"
import { getSetting } from "../../views/SettingsModal"
import { CheckIcon, ValidateResponse } from "./validate"

export default class SetupPage extends PageComponent {
    Id = "setup-page"
    override Title = "Mining Helper - Setup"
    override Node: Children

    Output = <div className="output validation-result" />

    constructor() {
        super()

        this.Node = <>
            <h2>Setup</h2>
            <p className="warning">This page is not yet complete. For more instructions, please see
                {" "}<a target="_blank" rel="noopener noreferrer" href="https://github.com/Jumprocks1/mining-helper/blob/main/docs/SETUP.md">GitHub</a>.</p>
            <br />
            <p>This page will walk you through setting up Anki Mining Helper. Start by using the button below.</p>
            <LoadingButton onClick={() => this.CheckSettings()}>Check Current Settings</LoadingButton>
            {this.Output}
        </>

        // this.CheckSettings() // nice when testing
    }

    async CheckSettings() {
        this.Output.replaceChildren()

        try {
            await this.CheckJpdb()
            await this.CheckServer()
        } catch (e) {
            replaceChildren(this.Output, userErrorMessage(e))
        }
    }

    Recheck(target: () => Promise<void>) {
        return <LoadingButton onClick={async () => {
            try {
                await target()
            } catch (e) {
                replaceChildren(this.Output, userErrorMessage(e))
            }
        }}>Recheck</LoadingButton>
    }

    AddReplace(el: HTMLElement) {
        const found = document.getElementById(el.id)
        if (found) {
            found.replaceWith(el)
        } else {
            this.Output.append(el)
        }
    }

    CheckServer = async () => {
        try {
            const pingResult = await fetch(await getHttpServerAddress(), { method: "GET" })
        } catch {
            // TODO should mention that the server might already be set up, just not running
            const res = <div>
                Failed to connect to {await getHttpServerAddress()}{"\n"}
                This connection is required in order to communicate with mpv.{"\n"}
                {"\n"}
                To get started, download the server <a target="_blank" rel="noopener noreferrer"
                    className="colored"
                    href="https://github.com/Jumprocks1/mining-helper/releases">from GitHub</a>.{"\n"}
                Once downloaded, unzip and run "setup.bat".{"\n"}
                For manual setup instructions, see the included README.txt file.{"\n"}
                Once complete, check your settings again.
            </div>
            throw res
        }
        try {
            // TODO this checks things pretty well, but it doesn't give proper advice for fixing
            // the styles/formatting are also different from the jpdb validation
            const resp = await serverPost("validate")
            const json = await resp.json() as ValidateResponse
            if (json.error) throw json.userMessage
            if (json.connected) this.Output.append(<div className="row">{CheckIcon()}Server connected</div>)
            else this.Output.append(<div className="warning">Server not connected</div>)

            if (!json.ffmpegFound) {
                this.Output.append(<div className="warning">
                    ffmpeg not found. Please place it in the system path or in the `lib` folder next to appsettings.json
                </div>)
            } else {
                this.Output.append(<div className="row">
                    {CheckIcon()}ffmpeg found
                </div>)
            }
            if (!json.pipe) {
                this.Output.append(<div className="warning">mpv IPC pipe not connected - please make sure you started the server through the mpv script</div>)
            } else {
                this.Output.append(<div className="row">{CheckIcon()}mpv IPC pipe connected</div>)
            }
            if (!json.mpvFound) {
                this.Output.append(<div className="warning">mpv folder not found - this is fine if everything else is working. Otherwise, please install mpv</div>)
            } else {
                if (json.mpvScriptFound) {
                    this.Output.append(<div className="row">{CheckIcon()}mpv script found</div>)
                } else {
                    this.Output.append(<div className="warning">mpv script not found - please place `mining_helper.lua` in your mpv scripts folder</div>)
                }
            }

            const websocket = new MpvWebSocket()
            await websocket.Connect()
            if (websocket.Open) {
                this.Output.append(<div className="row">{CheckIcon()}WebSocket connected</div>)
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

    CheckJpdb = async () => {
        const o = <div id="jpdb-result">
            <div className="row">
                <span className="loading-icon" />Checking jpdb.io connection
            </div>
        </div>
        this.AddReplace(o)

        const setError = async (message: string) => {
            o.replaceChildren(<div className="spaced">
                <div className="row">
                    {<Icon icon="error" className="error" />}
                    {message}
                </div>
                {await JpdbApiKeyField()}
                {this.Recheck(this.CheckJpdb)}
            </div>)
        }

        const apiKey = await getSetting("jpdbApiKey")
        if (!apiKey?.trim()) {
            return setError("No jpdb API key found, please add one below")
        }

        const resp = await callJpdb("ping", {})
        if (resp.error === "bad_key") {
            return setError("Invalid jpdb API key, please add one below")
        }

        o.replaceChildren(<div className="row">
            {CheckIcon()} Connected to jpdb.io
        </div>)
    }
}