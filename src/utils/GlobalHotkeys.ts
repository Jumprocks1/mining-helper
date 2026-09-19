import { JsPopover } from "../components/basic/JsPopover";
import { jpdbTranslate } from "../jpdb/JpdbParseText";
import { UnicodeCharacterType, unicodeType } from "./AnkiUtil";
import { jpdbEntryUrl } from "./util";

export function openTab(url: string) {
    if (typeof browser !== "undefined") {
        browser.tabs.create({ url })
    } else {
        if (url.startsWith("http"))
            window.open(url, "_blank", "noopener,noreferrer");
        else if (typeof browser !== "undefined") {
            browser.runtime.sendMessage(`open:${url}`);
        }
    }
}

export function keyDownWithText(ev: KeyboardEvent, text: string) {
    if (!text) return
    const key = ev.key.toLowerCase()
    if (key === "j") {
        openTab(`https://jisho.org/search/${encodeURIComponent(text)}`)
        ev.preventDefault()
        return true
    } else if (key == "d") {
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
    } else if (key == "n") {
        const isSingleKanji = text.length === 1 && unicodeType(text) === UnicodeCharacterType.Kanji
        if (isSingleKanji) {
            openTab(`https://jiten.moe/kanji/${encodeURIComponent(text)}`)
            ev.preventDefault()
            return true
        }
        else {
            openTab(`https://jiten.moe/parse?text=${encodeURIComponent(text)}`)
            ev.preventDefault()
            return true
        }
    } else if (key === "s") {
        openTab(`ss.html?q=${encodeURIComponent(text)}`)
        ev.preventDefault()
        return true
    }
}

export function handleKeyDown(ev: KeyboardEvent) {
    const sel = getSelection()
    if (sel && !sel.isCollapsed) {
        if (keyDownWithText(ev, getCleanSelectionString(sel)))
            return true
    }

    return false
}

function getCleanSelectionString(sel: Selection) {
    // Used to do more complex stuff here, but this seems fine?
    return sel.toString()
}

function isJapanese(s: string) {
    for (let i = 0; i < s.length; i++) {
        const type = unicodeType(s[i])
        if (type === UnicodeCharacterType.Kana || type === UnicodeCharacterType.Kanji)
            return true
    }
    return false
}

export function handleTranslate(): Promise<unknown> | false {
    const selection = getSelection()
    const hasSelection = selection !== null && !selection.isCollapsed
    if (hasSelection) {
        const s = getCleanSelectionString(selection)
        if (isJapanese(s)) return showTranslation(selection, s)
    }
    return false
}

let translationPopup: JsPopover | undefined
async function showTranslation(selection: Selection, s: string) {
    if (translationPopup) translationPopup.Close()
    const view = new JsPopover({
        type: "info-popup",
        id: "translation-popup",
        hydrate: () => jpdbTranslate(s)
    })
    view.AnchorToRange(selection.getRangeAt(0))
    view.Open()
    view.FixPosition()
    translationPopup = view
}

export function disallowGlobalInput(ev: KeyboardEvent) {
    const targetElement = ev.target as HTMLElement | null
    if (targetElement) {
        const selection = getSelection()
        const hasSelection = selection !== null && !selection.isCollapsed
        // super sketchy, but we want to allow lookups if we have something highlighted
        // to make this less sketchy, I think we would add this logic to the global handler
        // the global handler would make the decsion if we were allowed to trigger or not
        const key = ev.key.toLowerCase()
        if ((key === "d" || key === "s" || key === "j") && hasSelection) {
            if (isJapanese(selection.toString()))
                return false
        }
        if (targetElement.nodeName === "INPUT" || targetElement.isContentEditable || targetElement.nodeName === "BUTTON")
            return true
    }
}
