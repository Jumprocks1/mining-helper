import { UnicodeCharacterType, unicodeType } from "../anki/CardList";

export function openTab(url: string) {
    if (chrome.tabs) {
        chrome.tabs.create({ url })
    } else {
        window.open(url, "_blank", "noopener,noreferrer");
    }
}

export function keyPressedWithText(ev: KeyboardEvent, text: string) {
    if (!text) return
    if (ev.key === "j") {
        openTab(`https://jisho.org/search/${encodeURIComponent(text)}`)
        return true
    } else if (ev.key == "d") {
        const isSingleKanji = text.length === 1 && unicodeType(text) === UnicodeCharacterType.Kanji
        if (isSingleKanji) {
            openTab(`https://jpdb.io/kanji/${encodeURIComponent(text)}`)
            return true
        }
        else {
            openTab(`https://jpdb.io/search?q=${encodeURIComponent(text)}&lang=english`)
            return true
        }
    } else if (ev.key === "s") {
        openTab(`ss.html?q=${encodeURIComponent(text)}`)
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