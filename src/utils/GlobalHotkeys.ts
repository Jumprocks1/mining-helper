import { UnicodeCharacterType, unicodeType } from "../anki/CardList";
import { jpdbEntryUrl } from "./util";

export function openTab(url: string) {
    if (chrome.tabs) {
        chrome.tabs.create({ url })
    } else {
        if (url.startsWith("http"))
            window.open(url, "_blank", "noopener,noreferrer");
        else {
            chrome.runtime.sendMessage(`open:${url}`);
        }
    }
}

export function keyPressedWithText(ev: KeyboardEvent, text: string) {
    if (!text) return
    if (ev.key === "j") {
        openTab(`https://jisho.org/search/${encodeURIComponent(text)}`)
        ev.preventDefault()
        return true
    } else if (ev.key == "d") {
        const isSingleKanji = text.length === 1 && unicodeType(text) === UnicodeCharacterType.Kanji
        if (isSingleKanji) {
            openTab(`https://jpdb.io/kanji/${encodeURIComponent(text)}`)
            ev.preventDefault()
            return true
        }
        else {
            openTab(jpdbEntryUrl(text))
            ev.preventDefault()
            return true
        }
    } else if (ev.key === "s") {
        openTab(`ss.html?q=${encodeURIComponent(text)}`)
        ev.preventDefault()
        return true
    }
}

export function handleKeypress(ev: KeyboardEvent) {
    const sel = getSelection()
    if (sel && !sel.isCollapsed) {
        if (keyPressedWithText(ev, sel.toString())) return true
    }

    return false
}

function isJapanese(s: string) {
    for (let i = 0; i < s.length; i++) {
        const type = unicodeType(s[i])
        if (type === UnicodeCharacterType.Kana || type === UnicodeCharacterType.Kanji)
            return true
    }
    return false
}

export function disallowGlobalInput(ev: KeyboardEvent) {
    const targetElement = ev.target as HTMLElement | null
    if (targetElement) {
        const selection = getSelection()
        const hasSelection = selection !== null && !selection.isCollapsed
        // super sketchy, but we want to allow lookups if we have something highlighted
        // to make this less sketchy, I think we would add this logic to the global handler
        // the global handler would make the decsion if we were allowed to trigger or not
        if ((ev.key === "d" || ev.key === "s" || ev.key === "j") && hasSelection) {
            if (isJapanese(selection.toString()))
                return false
        }
        if (targetElement.nodeName === "INPUT" || targetElement.isContentEditable)
            return true
    }
}
