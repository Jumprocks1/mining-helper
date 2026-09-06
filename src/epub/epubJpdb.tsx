import { loadIgnoreList } from "../jpdb/IgnoreList";
import JpdbParseText, { JpdbParseResponse } from "../jpdb/JpdbParseText";
import { EpubPage } from "./epub";

export default async (page: EpubPage, cacheOnly?: true) => {
    loadIgnoreList()
    const lines = getLinesIn(page) // takes ~1ms for large pages, could probably make it faster but oh well
    if (lines.length === 0) return { tokens: [], vocab: [] }

    // TODO parse
    return lines
}



const ignoreTags = new Set(["RT", "TITLE", "SVG", "IMG"])
// mostly from https://www.w3schools.com/html/html_blocks.asp
const blockTags = new Set([
    "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT",
    "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM",
    "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN",
    "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "TFOOT", "UL"
])

function getLinesIn(page: EpubPage) {
    return visit(page, [])
}

function visit(element: Element, lines: string[]): string[] {
    let text = ""

    const flush = () => {
        if (text.trim()) lines.push(text)
        text = ""
    }

    for (const e of element.childNodes) {
        if (e.nodeType === Node.TEXT_NODE) {
            if (e.nodeValue?.trim())
                text += e.nodeValue
        } else if (e.nodeType === Node.ELEMENT_NODE) {
            const element = e as Element
            const tag = element.tagName

            if (ignoreTags.has(tag))
                continue
            if (element.tagName === "BR") {
                flush()
                continue
            }
            if (blockTags.has(element.tagName)) {
                flush()
                visit(element, lines)
            } else {
                text += inlineText(element)
            }
        }
    }

    flush()
    return lines
}

// Inline elements are assumed to have no block content in them
function inlineText(element: Element): string {
    let text = ""
    for (const e of element.childNodes) {
        if (e.nodeType === Node.TEXT_NODE) {
            text += e.nodeValue ?? ""
        } else if (e.nodeType === Node.ELEMENT_NODE) {
            const element = e as Element
            if (!ignoreTags.has(element.tagName)) {
                text += inlineText(element)
            }
        }
    }
    return text
}
