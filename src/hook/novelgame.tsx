import "../framework/createElement"

const mainTextSelector = ".message_inner";
const nameSelector = ".name_space"
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
    const text = el?.textContent ?? ""
    debounceText(text)
}

let pendingTextLoad: number | undefined = undefined
let lastText = ""
function debounceText(text: string) {
    if (!text || text === lastText) return
    lastText = text
    clearTimeout(pendingTextLoad)
    const name = document.querySelector(nameSelector)?.textContent
    const message = { type: "hook-text", text, name }
    pendingTextLoad = setTimeout(() => browser.runtime.sendMessage(message), stableDelayMs)
}

const observer = new MutationObserver(queueUpdate)
observer.observe(document.body, { childList: true, subtree: true })