import IconButton from "../../components/basic/IconButton"
import { PageComponent } from "../../framework/PageComponent"
import { playAudio } from "../../utils/Audio"
import { mutatePendingCard } from "../../utils/MiningUtil"
import { lookupFuri, urlToArrayBuffer } from "../../utils/util"


interface SsEntry {
    source: string
    audio_jap: string
    jap: string
    eng: string

    search: string

    audioBytes?: Promise<ArrayBuffer | undefined>
}

export default class SentenceSearchPage extends PageComponent {
    Id = "ss-page"
    override Title = "Mining Helper - Sentences"

    SearchInput = <input autocomplete="off" id="search" placeholder="Search..." /> as HTMLInputElement
    SearchButton = <IconButton icon="search" />
    Form = <form id="search-container">
        {this.SearchInput}
        {this.SearchButton}
    </form> as HTMLFormElement
    Results = <div id="results">
    </div>
    Node = [this.Form, this.Results]

    override Load = async () => {
        const audioBaseUrl = "https://receptomanijalogi.web.app/audio/"
        const dataUrl = chrome.runtime.getURL("all_v11.json")
        const dataPromise = fetch(dataUrl)
        const query = new URLSearchParams(location.search).get("q")
        if (query) this.SearchInput.value = query;

        const data: SsEntry[] = await (await dataPromise).json()
        data.forEach(e => {
            e.search = (e.eng + " " + e.jap).toLowerCase()
        })


        const updateCard = async (entry: SsEntry) => {
            const query = this.SearchInput.value

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

        const update = () => {
            const query = this.SearchInput.value.trim()
            this.Results.replaceChildren()
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
                const playButton = <IconButton icon="play_arrow" />
                const row = <div className="match">
                    {playButton}
                    <div>
                        {jap}
                        <span className="eng">{res.eng}</span>
                    </div>
                </div>
                this.Results.appendChild(row)
                row.addEventListener("click", async ev => {
                    res.audioBytes ??= urlToArrayBuffer(audioBaseUrl + res.audio_jap)
                    playAudio(res.audio_jap, res.audioBytes)

                    // don't update card if we only clicked the play button
                    if (ev.target === playButton) return

                    this.Results.querySelectorAll(".selected").forEach(e => e.classList.remove("selected"))
                    row.classList.add("selected")
                    updateCard(res)
                })
                i += 1
                if (i > 100) break
            }
        }
        this.Form.addEventListener("submit", ev => { ev.preventDefault(); update() })
        this.SearchButton.addEventListener("click", update)
        update()
    }
}
