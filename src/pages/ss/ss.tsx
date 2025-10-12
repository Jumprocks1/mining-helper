import MhHeader from "../../components/MhHeader"
import { seedPage } from "../../components/util"


const dataUrl = chrome.runtime.getURL("all_v11.json")
const dataPromise = fetch(dataUrl)

interface SsEntry {
    source: string
    audio_jap: string
    jap: string
    eng: string

    search: string
}

const searchInput = <input autocomplete="off" id="search" /> as HTMLInputElement
const searchButton = <span className="search-icon icon-button material-symbols-outlined">search</span>
const form = <form id="search-container">
    {searchInput}
    {searchButton}
</form> as HTMLFormElement

const results = <div id="results">
</div>

const body = <div id="body-container">
    {form}
    {results}
</div>


document.addEventListener("DOMContentLoaded", async () => {
    seedPage("ss-page", [
        MhHeader(),
        body
    ])


    const data: SsEntry[] = await (await dataPromise).json()
    data.forEach(e => {
        e.search = (e.eng + " " + e.jap).toLowerCase()
    })

    function update() {
        const query = searchInput.value.trim()
        results.replaceChildren()
        if (!query) {
            return
        }

        const parts = query.toLowerCase().split(" ")
        let matching = data
        for (let part of parts) {
            part = part.trim()
            matching = matching.filter(e => e.search.includes(part))
        }
        matching.sort((a, b) => a.jap.length - b.jap.length)

        let i = 0;
        for (const res of matching) {
            // TODO add audio + keyword highlighting
            results.appendChild(<div className="match">
                <span className="jap">{res.jap}</span>
                <span className="eng">{res.eng}</span>
            </div>)
            i += 1
            if (i > 100) break
        }
    }
    form.addEventListener("submit", ev => { ev.preventDefault(); update() })
    searchButton.addEventListener("click", update)
    update()
})
