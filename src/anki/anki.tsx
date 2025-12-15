import MhHeader from "../components/MhHeader"
import { seedPage } from "../framework/util"
import AnkiTreeView from "./AnkiTreeView"
import CardList from "./CardList"

document.addEventListener("DOMContentLoaded", () => {
    seedPage("anki-page", [
        MhHeader(),
        <div id="body-container">
            {CardList()}
            {AnkiTreeView()}
        </div>
    ])
})