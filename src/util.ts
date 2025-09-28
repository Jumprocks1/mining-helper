let _apiKey: string | undefined = undefined
function getApiKey() {
    if (_apiKey) return _apiKey;
    // TODO need better way of settings
    // for now, run chrome.storage.local.set({apiKey:"XXX"})
    return (async function () {
        _apiKey = (await chrome.storage.local.get({ apiKey: undefined })).apiKey
        return _apiKey
    })()
}

export async function lookupFuri(jp: string) {
    const res = await fetch("https://jpdb.io/api/v1/parse", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${await getApiKey()}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text: jp,
            token_fields: [
                "position",
                "length",
                "furigana"
            ],
            position_length_encoding: "utf16"
        })
    })
    const json = await res.json()
    // TODO we could get the furi for the kanji, but for now that will come from jpdb mining
    let o = ""
    for (const token of json.tokens) {
        const [position, length, furi] = token
        if (furi === null) {
            o += jp.substring(position, position + length)
        }
        else {
            for (const part of furi) {
                if (!Array.isArray(part)) {
                    o += part
                } else {
                    if (o.length > 0) {
                        const prev = o[o.length - 1]
                        if (prev !== "]" && prev !== ">")
                            o += " "
                    }
                    o += `${part[0]}[${part[1]}]`
                }
            }
        }
    }
    return o
}

export interface CardData {
    audioLocalFile?: string
    sentenceAudioLocalFile?: string
    meaning?: string
    kanji?: string
    furigana?: string
    jpSentenceKanji?: string
    jpSentenceFuri?: string
    enSentence?: string
    audioBytes?: ArrayBuffer
    sentenceAudioBytes?: ArrayBuffer

    modified?: number
    sentenceIndex?: number
    meaningIndex?: number
}

export function furiToReading(s: string) {
    if (!s) return s
    // TODO this will have issues with compound kanji
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

type Child = Node | string

interface ElementProps {
    className?: string
    textContent?: string
    innerHTML?: string
    children?: Child[]
    tooltip?: Child[] | Child
    onClick?: EventListenerOrEventListenerObject
    href?: string
}

export function tooltip(node: HTMLElement, text: Child[] | Child) {
    const tooltip = document.createElement("div")
    tooltip.classList.add("tooltip")
    if (Array.isArray(text))
        tooltip.replaceChildren(...text)
    else
        tooltip.replaceChildren(text)
    node.append(tooltip)
}

export function createElement<T extends keyof HTMLElementTagNameMap>(type: T, props: ElementProps): HTMLElementTagNameMap[T] {
    const el = document.createElement(type)
    if (props.className) el.className = props.className
    if (props.textContent) el.textContent = props.textContent
    if (props.innerHTML) el.innerHTML = props.innerHTML
    if (props.children) el.replaceChildren(...props.children)
    if (props.tooltip) tooltip(el, props.tooltip)
    if (props.onClick) el.addEventListener("click", props.onClick)
    if (props.href) {
        (el as HTMLAnchorElement).href = props.href;
        (el as HTMLAnchorElement).target = "_blank"
    }
    return el
}