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
        return true
    } else if (ev.key == "d") {
        const isSingleKanji = text.length === 1 && unicodeType(text) === UnicodeCharacterType.Kanji
        if (isSingleKanji) {
            openTab(`https://jpdb.io/kanji/${encodeURIComponent(text)}`)
            return true
        }
        else {
            openTab(jpdbEntryUrl(text))
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