import { Children } from "../framework/createElement"
import { loadPage, Page } from "../framework/Page"
import Layout from "../pages/Layout"
import AnkiTreeView from "./AnkiTreeView"
import CardList from "./CardList"


document.addEventListener("DOMContentLoaded", () => loadPage(AnkiPage))

export default class AnkiPage extends Page {
    Id = "anki-page"
    override Title = "Mining Helper - Anki"
    Node: Children
    override Layout = Layout
    constructor() {
        super()
        this.Node = [CardList, AnkiTreeView]
    }
}
