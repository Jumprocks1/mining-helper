import MhHeader from "../components/MhHeader"
import { seedPage } from "../components/util"
import CardList from "./CardList"

document.addEventListener("DOMContentLoaded", () => {
    seedPage("anki-page", [
        MhHeader(),
        <div id="body-container">
            {CardList()}
        </div>
    ])
})