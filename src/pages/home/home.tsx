import MhHeader from "../../components/MhHeader"
import { seedPage } from "../../framework/util"
import { saveToAnkiAndRemove, updateInAnkiAndRemove } from "../../utils/AnkiUtil"
import { CardData, oldCreateElement, furiToReading } from "../../utils/util"



const resultDiv = <div id="result" className="hide" />
function clearResult() {
    resultDiv.classList = "hide"
}
function showError(err: string) {
    resultDiv.textContent = err
    resultDiv.classList = "error"
}
function showMessage(message: string) {
    resultDiv.textContent = message
    resultDiv.classList = "success"
}

async function handleErrors(func: () => void | Promise<void>, message = "Success") {
    try {
        clearResult()
        await func()
        showMessage(message)
    } catch (e) {
        showError((e as Error).message)
    }
}

const cardContainer = <div id="card-container" />

document.addEventListener("DOMContentLoaded", () => {
    seedPage("popup-page", [
        MhHeader(),
        <div id="body-container">
            <h2>Pending Cards</h2>
            {cardContainer}
            {resultDiv}
        </div>
    ])

    async function refresh() {
        const cardsObject = await chrome.storage.session.get()
        const cards: CardData[] = []
        for (const key in cardsObject)
            cards.push(cardsObject[key])
        cards.sort((a, b) => a.modified - b.modified)
        const newChildren = cards.map(e => {
            return oldCreateElement("div", {
                className: "card-row",
                children: [
                    oldCreateElement("span", { className: "kanji", textContent: e.kanji, tooltip: furiToReading(e.furigana) }),
                    "-",
                    e.meaningIndex ?
                        oldCreateElement("span", { className: "meaning-index", textContent: `m_${e.meaningIndex}`, tooltip: e.meaning })
                        : "",
                    e.sentenceIndex ?
                        oldCreateElement("span", {
                            className: "sentence-index", textContent: `ex_${e.sentenceIndex}`,
                            tooltip: [
                                oldCreateElement("div", { innerHTML: e.jpSentenceKanji }),
                                oldCreateElement("div", { textContent: e.enSentence })
                            ]
                        }) : "",
                    oldCreateElement("div", { className: "flex-spacer" }),
                    oldCreateElement("span", {
                        className: "delete-button button", textContent: "x", onClick: async ev => {
                            ev.preventDefault()
                            await chrome.storage.session.remove(e.kanji)
                            refresh()
                        }
                    }),
                    oldCreateElement("span", {
                        className: "save-button button", textContent: "save", onClick: async ev => {
                            ev.preventDefault()
                            handleErrors(async () => {
                                await saveToAnkiAndRemove(e)
                                await refresh()
                            }, "Saved " + e.kanji)
                        }
                    }),
                    oldCreateElement("span", {
                        className: "update-button button", textContent: "up", onClick: async ev => {
                            ev.preventDefault()
                            handleErrors(async () => {
                                await updateInAnkiAndRemove(e)
                                await refresh()
                            }, "Updated")
                        }
                    }),
                    oldCreateElement("a", {
                        className: "sentence-search button", textContent: "ss",
                        href: "ss.html?q=" + encodeURIComponent(e.kanji)
                    })
                ]
            })
        })
        cardContainer.replaceChildren(...newChildren)
    }
    refresh()
})
