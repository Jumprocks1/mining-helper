import { Icon } from "../../components/basic/IconButton"
import LoadingButton from "../../components/LoadingButton"
import { Children, replaceChildren } from "../../framework/createElement"
import { PageComponent } from "../../framework/PageComponent"
import { callJpdb } from "../../jpdb/JpdbParseText"
import { userErrorMessage } from "../../utils/UserError"
import { JpdbApiKeyField } from "../../views/SettingsFields"
import { getSetting } from "../../views/SettingsModal"
import { CheckIcon } from "./validate"

export default class SetupPage extends PageComponent {
    Id = "setup-page"
    override Title = "Mining Helper - Setup"
    override Node: Children

    Output = <div className="output validation-result" />

    constructor() {
        super()

        this.Node = <>
            <h2>Setup</h2>
            <p>This page will walk you setting up Anki Mining Helper. Start by using the button below.</p>
            <LoadingButton onClick={() => this.CheckSettings()}>Check Current Settings</LoadingButton>
            {this.Output}
        </>

        // this.CheckSettings() // nice when testing
    }

    async CheckSettings() {
        this.Output.replaceChildren()

        try {
            await this.CheckJpdb()
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