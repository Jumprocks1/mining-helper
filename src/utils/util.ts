let _apiKey: string | undefined = undefined
export function getJpdbApiKey() {
    if (_apiKey) return _apiKey;
    // TODO need better way of settings
    // for now, run chrome.storage.local.set({apiKey:"XXX"})
    return (async function () {
        _apiKey = (await chrome.storage.local.get("apiKey")).apiKey
        return _apiKey
    })()
}

export function jpdbEntryUrl(word: string) {
    return `https://jpdb.io/search?q=${encodeURIComponent(word)}&lang=english`
}

export async function lookupFuri(jp: string | undefined, highlight?: string) {
    if (!jp) return jp
    const res = await fetch("https://jpdb.io/api/v1/parse", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${await getJpdbApiKey()}`,
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
    const highlightStart = highlight !== undefined && jp.indexOf(highlight)
    const highlightLength = highlight?.length
    const highlightEnd = highlightStart !== false && highlightLength && (highlightStart + highlightLength)
    // TODO we could get the furi for the kanji, but for now that will come from jpdb mining
    let i = 0
    let highlightOpen = false
    function pushMain(count = 1) {
        for (let j = 0; j < count; j++) {
            if (i === highlightStart) {
                o += "<b>"
                highlightOpen = true
            }
            // TODO don't cancel highlight unless it's the end of a parsing block
            // might cause issues with compound nouns? but should be good for verbs
            // could make it only apply for kana
            // code >= 0x3040 && code <= 0x309F
            // https://www.unicode.org/charts/PDF/Unicode-3.2/U32-3040.pdf
            if (highlightOpen && i === highlightEnd) {
                o += "</b>"
                highlightOpen = false
            }
            o += jp![i]
            i += 1
        }
    }
    let o = ""
    for (const token of json.tokens) {
        const [position, length, furi] = token
        // sometimes tokens just get skipped in json.tokens. This pushes any skipped tokens. Frequently saw with jp comma
        pushMain(position - i)
        if (furi === null) {
            pushMain(length)
        }
        else {
            for (const part of furi) {
                if (!Array.isArray(part)) {
                    pushMain(part.length)
                } else {
                    if (o.length > 0) {
                        const prev = o[o.length - 1]
                        if (prev !== "]" && prev !== ">" && i !== highlightStart && i !== highlightEnd)
                            o += " "
                    }
                    pushMain(part[0].length)
                    o += `[${part[1]}]`
                }
            }
        }
    }
    // push any remaining tokens, usually need this when there's loose punctuation or kana at the end
    pushMain(jp.length - i)
    if (highlightOpen && i === highlightEnd) {
        o += "</b>"
        highlightOpen = false
    }
    return o
}

export interface CardData {
    kanji: string
    modified: number

    audioLocalFile?: string
    sentenceAudioLocalFile?: string
    meaning?: string
    furigana?: string
    jpSentenceKanji?: string
    jpSentenceFuri?: string
    enSentence?: string
    audioBytes?: ArrayBuffer
    sentenceAudioBytes?: ArrayBuffer

    sentenceIndex?: string
    meaningIndex?: string
}

export function furiToReading(s: string | undefined) {
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
    data?: Record<string, string | undefined>;
    className?: string
    textContent?: string
    innerHTML?: string
    children?: Child[]
    tooltip?: Child[] | Child
    onClick?: EventListenerOrEventListenerObject
    href?: string
    mutate?: (e: HTMLElement) => void
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

export function oldCreateElement<T extends keyof HTMLElementTagNameMap>(type: T, props: ElementProps): HTMLElementTagNameMap[T] {
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
    if (props.data) {
        for (const key in props.data) {
            const v = props.data[key]
            if (v)
                el.dataset[key] = v
        }
    }
    if (props.mutate) props.mutate(el)
    return el
}

export async function urlToArrayBuffer(url: string | undefined) {
    if (!url) return
    const res = await fetch(url)
    return await (await res.blob()).arrayBuffer()
}

// don't use for real code, useful for testing though
export function delay(delay: number) {
    return new Promise<void>(resolve => setTimeout(() => resolve(), delay))
}