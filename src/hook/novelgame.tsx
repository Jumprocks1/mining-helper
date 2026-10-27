import "../framework/createElement"

const querySelector = ".message_inner";
// only count as final once this amount of ms has passed and no changes are found
const stableDelayMs = 100

let updateQueued = false
function queueUpdate() {
    if (updateQueued) return
    updateQueued = true
    requestAnimationFrame(update)
}

function update() {
    updateQueued = false
    const el = document.querySelector(querySelector)
    const text = el?.textContent ?? ""
    debounceText(text)
}

let pendingTextLoad: number | undefined = undefined
let pendingTextString = ""
function debounceText(text: string) {
    if (!text || text === pendingTextString) return
    clearTimeout(pendingTextLoad)
    pendingTextLoad = setTimeout(() => processText(text), stableDelayMs)
}

function processText(text: string) {
    browser.runtime.sendMessage({
        type: "hook-text",
        value: text
    })
}

const observer = new MutationObserver(queueUpdate)
observer.observe(document.body, { childList: true, subtree: true })