import { Children } from "../../framework/createElement"
import { PageComponent } from "../../framework/PageComponent"

export default class SetupPage extends PageComponent {
    Id = "setup-page"
    override Title = "Mining Helper - Setup"
    override Node: Children

    constructor() {
        super()

        this.Node = <>
            <h2>Setup</h2>
            <p>This page will walk you setting up Anki Mining Helper.</p>
        </>
    }
}