import MhHeader from "../../components/MhHeader"
import { seedPage } from "../../components/util"
import { CardData, lookupFuri, urlToArrayBuffer } from "../../utils/util"


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

let audioContext: AudioContext | undefined = undefined

let playing: AudioBufferSourceNode[] = []

function stopAll() {
    playing.forEach(e => e.stop())
    playing = []
}

async function play(bytes: ArrayBuffer) {
    audioContext ??= new AudioContext()
    const source = audioContext.createBufferSource();
    // audio thread needs a copy of the buffer, so we have to slice
    source.buffer = await audioContext.decodeAudioData(bytes.slice(0));
    source.connect(audioContext.destination);

    stopAll()

    let i = playing.length
    playing.push(source)
    source.onended = () => playing = playing.splice(i, 1)
    source.start()
}


document.addEventListener("DOMContentLoaded", async () => {
    seedPage("ss-page", [
        MhHeader(),
        body
    ])


    const data: SsEntry[] = await (await dataPromise).json()
    data.forEach(e => {
        e.search = (e.eng + " " + e.jap).toLowerCase()
    })


    async function updateCard(entry: SsEntry) {
        const keys = await chrome.storage.session.getKeys()
        const query = searchInput.value.trim()
        let kanji = query
        const foundKey = keys.find(e => e.includes(kanji))
        if (foundKey) kanji = foundKey

        const card: CardData = (await chrome.storage.session.get({ [kanji]: {} }))[kanji]
        card.kanji = kanji
        card.jpSentenceKanji = entry.jap
        card.enSentence = entry.eng

        card.sentenceAudioBytes = await entry.audioBytes
        card.sentenceAudioLocalFile = `${card.kanji}_ex_sentencesearch.ogg`
        card.sentenceIndex = "ss_" + data.indexOf(entry)

        card.jpSentenceFuri = await lookupFuri(card.jpSentenceKanji, query)
        card.jpSentenceKanji = card.jpSentenceKanji.replace(query, "<b>" + query + "</b>")

        console.log(card)
        chrome.storage.session.set({ [kanji]: card })
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
            const row = <div className="match">
                {jap}
                <span className="eng">{res.eng}</span>
            </div>
            results.appendChild(row)
            row.addEventListener("click", async () => {
                results.querySelectorAll(".selected").forEach(e => e.classList.remove("selected"))
                const audioBaseUrl = "https://receptomanijalogi.web.app/audio/"
                row.classList.add("selected")

                res.audioBytes ??= urlToArrayBuffer(audioBaseUrl + res.audio_jap)
                const bytes = await res.audioBytes
                if (bytes) play(bytes)

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
