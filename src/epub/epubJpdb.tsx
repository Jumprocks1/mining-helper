import { loadIgnoreList } from "../jpdb/IgnoreList";
import JpdbParseText, { JpdbParseResponse } from "../jpdb/JpdbParseText";
import { EpubPage } from "./epub";

export default async (page: EpubPage, cacheOnly?: true): Promise<JpdbParseResponse | undefined> => {
    loadIgnoreList()
    if (page.jpdb) return page.jpdb
    const nodeLines = getLinesIn(page) // takes ~1ms for large pages, could probably make it faster but oh well
    let s = ""
    const lines = []
    for (let i = 0; i < nodeLines.length; i++) {
        const e = nodeLines[i]
        if (e === newLine) {
            lines.push(s)
            s = ""
        }
        else s += e.nodeValue!
    }
    if (nodeLines.length === 0) return { tokens: [], vocabulary: [] }
    const res = await JpdbParseText(lines, cacheOnly)
    if (res) page.jpdb = res
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

function getLinesIn(page: EpubPage) {
    const o: JpdbParseNode[] = []
    visit(page, o)
    return o
}

const newLine = Symbol("\\n")

type JpdbParseNode = Node | typeof newLine

function visit(element: Element, nodes: JpdbParseNode[]) {
    const flush = () => {
        if (nodes.length > 0 && nodes[nodes.length - 1] != newLine) nodes.push(newLine)
    }

    for (const e of element.childNodes) {
        if (e.nodeType === Node.TEXT_NODE) {
            if (e.nodeValue?.trim()) nodes.push(e)
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
function inlineText(element: Element, nodes: JpdbParseNode[]) {
    for (const e of element.childNodes) {
        if (e.nodeType === Node.TEXT_NODE) {
            if (e.nodeValue?.trim()) nodes.push(e)
        } else if (e.nodeType === Node.ELEMENT_NODE) {
            const element = e as Element
            if (!ignoreTags.has(element.tagName)) {
                inlineText(element, nodes)
            }
        }
    }
}
