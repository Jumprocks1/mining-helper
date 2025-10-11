import { UnicodeCharacterType, unicodeType } from "../anki/CardList";

export function handleKeypress(ev: KeyboardEvent) {
    const sel = getSelection()
    if (sel && !sel.isCollapsed) {
        const text = sel.toString()
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

    return false
}