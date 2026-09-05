import IconButton from "../../components/basic/IconButton"
import LoadingButton from "../../components/LoadingButton"
import { Children, replaceChildren } from "../../framework/createElement"
import { PageComponent } from "../../framework/PageComponent"
import SettingsValidator from "../../utils/SettingsValidator"
import { userErrorMessage } from "../../utils/UserError"
import SettingsModal, { } from "../../views/SettingsModal"
import { validateAnkiSettings } from "../anki/AnkiSettingsModal"
import { validateJpdb, validateServerConnection } from "./validate"

export default class SetupPage extends PageComponent {
    Id = "setup-page"
    override Title = "Mining Helper - Setup"
    override Node: Children

    Output = <div className="output" />

    constructor() {
        super()

        this.Node = <>
            <h2>Setup</h2>
            {/* TODO this page is probably better than the instructions now */}
            {/* Should improve instructions to match and then reword this warning */}
            <p className="warning">This page is not yet complete. For more instructions, see
                {" "}<a target="_blank" rel="noopener noreferrer" href="https://github.com/Jumprocks1/mining-helper/blob/main/docs/SETUP.md">SETUP.md</a>.</p>
            <br />
            <p>This page will walk you through setting up Anki Mining Helper. Start by using the button below.</p>
            <div className="button-group">
                <LoadingButton onClick={() => this.CheckSettings()}>Check Current Settings</LoadingButton>
                <IconButton icon="settings" onClick={() => SettingsModal()} tooltip="Open Settings" />
            </div>
            {this.Output}
        </>

        // this.CheckSettings() // nice when testing
    }

    async CheckSettings() {
        const tester = new SettingsValidator()

        this.Output.replaceChildren(tester.Node)

        await tester.Test(async tester => {
            await validateJpdb(tester, true)

            await validateServerConnection(tester, true)

            tester.Section("Anki")
            await validateAnkiSettings(tester, false)
        })
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
}