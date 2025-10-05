import MhHeader from "../components/MhHeader"
import { seedPage } from "../components/util"

document.addEventListener("DOMContentLoaded", () => {
    seedPage("anki-page", [
        MhHeader(),
        <div id="body-container">
        </div>
    ])
})