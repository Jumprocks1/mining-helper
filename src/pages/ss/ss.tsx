import IconButton from "../../components/basic/IconButton"
import MhHeader from "../../components/MhHeader"
import { seedPage } from "../../components/util"
import AddIcons from "../../utils/AddIcons"
import { playAudio } from "../../utils/Audio"
import { mutatePendingCard } from "../../utils/MiningUtil"
import { lookupFuri, urlToArrayBuffer } from "../../utils/util"

AddIcons()

const audioBaseUrl = "https://receptomanijalogi.web.app/audio/"
const dataUrl = chrome.runtime.getURL("all_v11.json")
const dataPromise = fetch(dataUrl)

interface SsEntry {
    source: string
    audio_jap: string
    jap: string
    eng: string

    search: string

    audioBytes?: Promise<ArrayBuffer | undefined>
}

const searchInput = <input autocomplete="off" id="search" placeholder="Search..." /> as HTMLInputElement
const searchButton = <IconButton icon="search" />
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

    const query = new URLSearchParams(location.search).get("q")
    if (query) searchInput.value = query

    const data: SsEntry[] = await (await dataPromise).json()
    data.forEach(e => {
        e.search = (e.eng + " " + e.jap).toLowerCase()
    })


    async function updateCard(entry: SsEntry) {
        const query = searchInput.value

        await mutatePendingCard(query, true, async card => {
            card.jpSentenceKanji = entry.jap
            card.enSentence = entry.eng

            card.sentenceAudioBytes = await entry.audioBytes
            card.sentenceAudioLocalFile = `${card.kanji}_ex_sentencesearch.ogg`
            card.sentenceIndex = "ss_" + data.indexOf(entry)

            card.jpSentenceFuri = await lookupFuri(card.jpSentenceKanji, query)
            card.jpSentenceKanji = card.jpSentenceKanji.replace(query, "<b>" + query + "</b>")

            card.source = "SS"
        })
    }

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
            const highlighted = res.jap.replace(query, "<b>" + query + "</b>")
            const jap = <span className="jap"></span>
            jap.innerHTML = highlighted
            const playButton = <span className="play-icon icon-button material-symbols-outlined">play_arrow</span>
            const row = <div className="match">
                {playButton}
                <div>
                    {jap}
                    <span className="eng">{res.eng}</span>
                </div>
            </div>
            results.appendChild(row)
            row.addEventListener("click", async ev => {
                res.audioBytes ??= urlToArrayBuffer(audioBaseUrl + res.audio_jap)
                playAudio(res.audio_jap, res.audioBytes)

                // don't update card if we only clicked the play button
                if (ev.target === playButton) return

                results.querySelectorAll(".selected").forEach(e => e.classList.remove("selected"))
                row.classList.add("selected")
                updateCard(res)
            })
            i += 1
            if (i > 100) break
        }
    }
    form.addEventListener("submit", ev => { ev.preventDefault(); update() })
    searchButton.addEventListener("click", update)
    update()
})
