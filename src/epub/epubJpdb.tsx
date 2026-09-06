import { loadIgnoreList } from "../jpdb/IgnoreList";
import JpdbParseText, { JpdbParseResponse } from "../jpdb/JpdbParseText";
import { EpubPage } from "./epub";

export interface JpdbParseResponseWithNodes extends JpdbParseResponse {
    nodes: Text[]
}

export default async (page: EpubPage, cacheOnly?: true): Promise<JpdbParseResponseWithNodes | undefined> => {
    loadIgnoreList()
    if (page.jpdb) return page.jpdb
    const nodes = getEpubTextNodes(page) // takes ~1ms for large pages, could probably make it faster but oh well
    let res: JpdbParseResponseWithNodes | undefined
    if (nodes.length === 0) res = { tokens: [], vocabulary: [], nodes: [] }
    else {
        let s = ""
        const lines = []
        for (let i = 0; i < nodes.length; i++) {
            const e = nodes[i]
            if (e === newLine) {
                lines.push(s)
                s = ""
            }
            else s += e.nodeValue!
        }
        res = await JpdbParseText(lines, cacheOnly) as JpdbParseResponseWithNodes | undefined
    }
    if (res) {
        page.jpdb = res
        res.nodes = nodes
    }
    return res
}



const ignoreTags = new Set(["RT", "TITLE", "SVG", "IMG"])
// mostly from https://www.w3schools.com/html/html_blocks.asp
const blockTags = new Set([
    "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT",
    "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM",
    "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN",
    "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "TFOOT", "UL"
])

function getEpubTextNodes(page: EpubPage) {
    const o: Text[] = []
    visit(page, o)
    return o
}

const newLine = new Text("\n")

function visit(element: Element, nodes: Text[]) {
    const flush = () => {
        if (nodes.length > 0 && nodes[nodes.length - 1] != newLine) nodes.push(newLine)
    }

    for (const e of element.childNodes) {
        if (e.nodeType === Node.TEXT_NODE) {
            if (e.nodeValue?.trim()) nodes.push(e as Text)
        } else if (e.nodeType === Node.ELEMENT_NODE) {
            const element = e as Element
            const tag = element.tagName
            if (ignoreTags.has(tag))
                continue
            if (tag === "BR") {
                flush()
                continue
            }
            if (blockTags.has(tag)) {
                flush()
                visit(element, nodes)
            } else {
                inlineText(element, nodes)
            }
        }
    }
    flush()
}

// Inline elements are assumed to have no block content in them
function inlineText(element: Element, nodes: Text[]) {
    for (const e of element.childNodes) {
        if (e.nodeType === Node.TEXT_NODE) {
            if (e.nodeValue?.trim()) nodes.push(e as Text)
        } else if (e.nodeType === Node.ELEMENT_NODE) {
            const element = e as Element
            if (!ignoreTags.has(element.tagName)) {
                inlineText(element, nodes)
            }
        }
    }
}
