/// <reference path="types.d.ts" />
/// <reference path="chrome.d.ts" />

document.addEventListener("DOMContentLoaded", () => {
    const container = document.getElementById("card-container")

    function furiToReading(s) {
        if (!s) return s
        let o = ""
        for (let i = 0; i < s.length; i++) {
            const c = s[i]
            if (c === "[")
                o = o.substring(0, o.length - 1)
            else if (c !== "]")
                o += c
        }
        return o
    }

    async function refresh() {
        const keys = await chrome.storage.session.getKeys()
        const cardsObject = await chrome.storage.session.get(keys)
        /** @type {CardData[]} */
        const cards = []
        for (const key in cardsObject)
            cards.push(cardsObject[key])
        cards.sort((a, b) => a.modified - b.modified)
        const newChildren = cards.map(e => {
            const node = document.createElement("div")

            /** @param {HTMLElement} node */
            function tooltip(node, text) {
                const tooltip = document.createElement("div")
                tooltip.classList.add("tooltip")
                if (Array.isArray(text))
                    tooltip.replaceChildren(...text)
                else
                    tooltip.replaceChildren(text)
                node.append(tooltip)
            }

            /**
             * @param {keyof HTMLElementTagNameMap} type 
             * @param {object} settings
             * @returns {HTMLElement}
             */
            function createElement(type, settings) {
                const el = document.createElement(type)
                if (settings.className) el.className = settings.className
                if (settings.textContent) el.textContent = settings.textContent
                if (settings.innerHTML) el.innerHTML = settings.innerHTML
                if (settings.children) el.replaceChildren(...settings.children)
                if (settings.tooltip) tooltip(el, settings.tooltip)
                if (settings.onClick) el.addEventListener("click", settings.onClick)
                if (settings.href) { el.href = settings.href; el.target = "_blank" }
                return el
            }
            return createElement("div", {
                children: [
                    createElement("span", { className: "kanji", textContent: e.kanji, tooltip: furiToReading(e.furigana) }),
                    " - ",
                    createElement("span", { className: "meaning-index", textContent: `m${e.meaningIndex + 1}`, tooltip: e.meaning }),
                    " ",
                    createElement("span", {
                        className: "sentence-index", textContent: `ex${e.sentenceIndex + 1}`,
                        tooltip: [
                            createElement("div", { innerHTML: e.jpSentenceKanji }),
                            createElement("div", { textContent: e.enSentence })
                        ]
                    }),
                    " ",
                    createElement("span", {
                        className: "delete-button", textContent: "x", onClick: async ev => {
                            ev.preventDefault()
                            await chrome.storage.session.remove(e.kanji)
                            refresh()
                        }
                    }),
                    " ",
                    createElement("a", {
                        className: "sentence-search", textContent: "ss",
                        href: "https://sentencesearch.neocities.org/#" + e.kanji
                    })
                ]
            })
        })
        container.replaceChildren(...newChildren)
    }
    refresh()
})
