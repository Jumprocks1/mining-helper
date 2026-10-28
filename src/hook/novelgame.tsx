import "../framework/createElement"

const mainTextSelector = ".message_inner";
const nameSelector = ".name_space"
// const extraQuery = ".button_graphic, .event-setting-element"
const optionSelector = ".event-setting-element"
// only count as final once this amount of ms has passed and no changes are found
const stableDelayMs = 200

let updateQueued = false
function queueUpdate() {
    if (updateQueued) return
    updateQueued = true
    requestAnimationFrame(update)
}

function update() {
    updateQueued = false
    const el = document.querySelector(mainTextSelector)
    let text = ""
    if (el) {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
            {
                acceptNode(node) {
                    if (node.nodeName === "BR" || node.nodeType === Node.TEXT_NODE)
                        return NodeFilter.FILTER_ACCEPT
                    return NodeFilter.FILTER_SKIP;
                }
            })
        let currentNode;
        while (currentNode = walker.nextNode()) {
            if (currentNode.nodeName === "BR") text += "\n"
            else text += currentNode.textContent
        }
    }
    debounceText(text)
}

let pendingTextLoad: number | undefined = undefined
let lastText = ""
function debounceText(text: string) {
    if (!text || text === lastText) return
    lastText = text
    clearTimeout(pendingTextLoad)
    const name = document.querySelector(nameSelector)?.textContent
    const options = [...document.querySelectorAll(optionSelector)].map(e => e.textContent).filter(e => e)
    const message = { type: "hook-text", text, name, options }
    pendingTextLoad = setTimeout(() => browser.runtime.sendMessage(message), stableDelayMs)
}

const observer = new MutationObserver(queueUpdate)
observer.observe(document.body, { childList: true, subtree: true })