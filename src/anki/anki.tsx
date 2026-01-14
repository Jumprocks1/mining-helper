import { Children } from "../framework/createElement"
import { PageComponent } from "../framework/PageComponent"
import AnkiTreeView from "./AnkiTreeView"
import CardList from "./CardList"
// TODO move to pages folder
export default class AnkiPage extends PageComponent {
    Id = "anki-page"
    override Title = "Mining Helper - Anki"
    Node: Children
    constructor() {
        super()
        this.Node = [CardList, AnkiTreeView]
    }
}
