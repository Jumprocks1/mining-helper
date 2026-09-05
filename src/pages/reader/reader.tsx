import { Children } from "../../framework/createElement"
import { PageComponent } from "../../framework/PageComponent"

export default class ReaderPage extends PageComponent {
    Id = "reader-page"
    override Title = "Mining Helper - Reader"
    override Node: Children

    constructor() {
        super()

        this.Node = "AA"
    }
}