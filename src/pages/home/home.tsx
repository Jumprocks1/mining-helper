import MhHeader from "../../components/MhHeader"
import { Children } from "../../framework/createElement"
import { loadPage, Page } from "../../framework/Page"
import { saveToAnkiAndRemove, updateInAnkiAndRemove } from "../../utils/AnkiUtil"
import { CardData, oldCreateElement, furiToReading } from "../../utils/util"


document.addEventListener("DOMContentLoaded", () => loadPage(HomePage))

export default class HomePage extends Page {
    Id = "home-page"
    override Title = "Mining Helper - Home"
    override Node: Children
    constructor() {
        super()

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

        this.Node = [
            MhHeader(),
            <div id="body-container">
                <h2>Helpful Links</h2>
                <ul id="helpful-links">
                    <li><a href="https://jimaku.cc/">Jimaku</a></li>
                    <li><a href="https://jpdb.io/">jpdb.io</a></li>
                    <li><a href="https://jisho.org/">jisho.org</a></li>
                    <li><a href="https://github.com/Jumprocks1/anki-mining-helper">Site source</a></li>
                    <li><a href="https://mpv.io/manual/master">mpv manual</a></li>
                    <li><a href="https://sentencesearch.neocities.org/">Sentence Search</a></li>
                </ul>
                <h2>Pending Cards</h2>
                {cardContainer}
                {resultDiv}
            </div>
        ]

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
    }
}