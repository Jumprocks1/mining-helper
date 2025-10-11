import { UnicodeCharacterType, unicodeType } from "../anki/CardList";

export function keyPressedWithText(ev: KeyboardEvent, text: string) {
    if (!text) return
    if (ev.key === "j") {
        chrome.tabs.create({ url: `https://jisho.org/search/${encodeURIComponent(text)}` });
        return true
    } else if (ev.key == "d") {
        const isSingleKanji = text.length === 1 && unicodeType(text) === UnicodeCharacterType.Kanji
        if (isSingleKanji) {
            chrome.tabs.create({ url: `https://jpdb.io/kanji/${encodeURIComponent(text)}` });
            return true
        }
        else {
            chrome.tabs.create({ url: `https://jpdb.io/search?q=${encodeURIComponent(text)}&lang=english` });
            return true
        }
    } else if (ev.key === "s") {
        chrome.tabs.create({ url: `https://sentencesearch.neocities.org/#${encodeURIComponent(text)}` });
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