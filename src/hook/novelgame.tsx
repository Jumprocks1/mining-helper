import "../framework/createElement"

const mainTextSelector = ".message_inner";
const nameSelector = ".name_space"
const optionSelector = ".event-setting-element"
const advanceClickSelector = ".layer_event_click"

// only count as final once this amount of ms has passed and no changes are found
const stableDelayMs = 300

let updateQueued = false
function queueUpdate() {
    if (updateQueued) return
    updateQueued = true
    requestAnimationFrame(update)
}

function update() {
    updateQueued = false
    const els = [...document.querySelectorAll(mainTextSelector)]
    let text = ""
    for (const el of els) {
        if (text != "") text += "\n\n"
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
    debounceText(text.trim())
}

let lastPayload: { name?: string, text: string, options?: any[] } = { text: "" }

let pendingTextLoad: number | undefined = undefined
let lastText = ""
let lastOptionsCount = 0
function debounceText(text: string) {
    // this is a bit tricky since we want to debounce, but also don't want to skip certain things
    const optionElements = document.querySelectorAll(optionSelector)
    if ((!text || text === lastText) && optionElements.length == lastOptionsCount) return
    const options = [...optionElements].map(e => e.textContent).filter(e => e)
    lastOptionsCount = options.length
    lastText = text

    clearTimeout(pendingTextLoad)
    const name = document.querySelector(nameSelector)?.textContent

    // needed because when trimming, we have to consider the entire message content
    // without this, a message that's split into 3 would not get trimmed on the 3rd send
    const fullPayload = { type: "hook-text", text, name, options }

    let trimmedPayload = fullPayload

    // note, we don't actually count a payload as the last payload until it's been sent
    if (name === lastPayload.name && text.startsWith(lastPayload.text))
        trimmedPayload = { ...trimmedPayload, text: text.substring(lastPayload.text.length).trim() }

    pendingTextLoad = setTimeout(() => {
        lastPayload = fullPayload
        browser.runtime.sendMessage(trimmedPayload)
    }, stableDelayMs)
}

const observer = new MutationObserver(queueUpdate)
observer.observe(document.body, { childList: true, subtree: true })

browser.runtime.onMessage.addListener(message => {
    if (message.type === "advance-page") {
        const el = document.querySelector<HTMLElement>(advanceClickSelector)
        if (el) el.click()
    }
})