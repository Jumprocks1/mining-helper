import { loadIgnoreList } from "../jpdb/IgnoreList";
import { ParseText, JpdbParseResponse, updateParseCache } from "../jpdb/JpdbParseText";
import { ReaderPageNode } from "./BaseReader";

export interface JpdbParseResponseWithNodes extends JpdbParseResponse {
    nodes: Text[]
}

export default async (page: ReaderPageNode, cacheOnly?: true): Promise<JpdbParseResponseWithNodes | undefined> => {
    loadIgnoreList()
    if (page.jpdb) return page.jpdb
    const nodes = getReaderPageTextNodes(page) // takes ~1ms for large pages, could probably make it faster but oh well
    let res: JpdbParseResponseWithNodes | undefined
    if (nodes.length === 0) res = { tokens: [], vocabulary: [], nodes: [] }
    else {
        const lines = nodesToLines(nodes)
        res = await ParseText(lines, cacheOnly) as JpdbParseResponseWithNodes | undefined
    }
    if (res) {
        page.jpdb = res
        res.nodes = nodes
    }
    return res
}

function nodesToLines(nodes: Text[]) {
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
    return lines
}

function mergeJpdbResults(a: JpdbParseResponseWithNodes, b: JpdbParseResponseWithNodes) {
    let offset = 0
    for (const node of a.nodes) offset += node.length

    const vocabMap = new Map<string, number>()
    for (let i = 0; i < a.vocabulary.length; i++)
        vocabMap.set(a.vocabulary[i].furigana, i)

    for (const token of b.tokens) {
        token[0] += offset
        const vocab = b.vocabulary[token[3]]
        const found = vocabMap.get(vocab.furigana)
        if (found === undefined) {
            token[3] = a.vocabulary.length
            a.vocabulary.push(vocab)
        } else {
            token[3] = found
        }
    }
    a.tokens.push(...b.tokens)
    a.nodes.push(...b.nodes)
}

export async function updateJpdbParse(page: ReaderPageNode, newElement: HTMLElement) {
    const jpdb = page.jpdb
    if (!jpdb) return
    const nodes = getReaderPageTextNodes(newElement)
    if (nodes.length === 0) return
    const lines = nodesToLines(nodes)
    const newJpdb = await ParseText(lines, undefined, true) as JpdbParseResponseWithNodes | undefined
    if (newJpdb) {
        newJpdb.nodes = nodes
        const oldLines = nodesToLines(jpdb.nodes)
        mergeJpdbResults(jpdb, newJpdb)
        const clonedJpdb: JpdbParseResponse = { tokens: jpdb.tokens, vocabulary: jpdb.vocabulary } // ignore nodes
        updateParseCache(oldLines, nodesToLines(jpdb.nodes), clonedJpdb)
    }
}



const ignoreTags = new Set(["RT", "TITLE", "SVG", "IMG", "RP"])
// mostly from https://www.w3schools.com/html/html_blocks.asp
const blockTags = new Set([
    "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT",
    "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM",
    "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN",
    "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "TFOOT", "UL"
])

function getReaderPageTextNodes(element: HTMLElement) {
    const o: Text[] = []
    visit(element, o)
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
            if (ignoreTags.has(tag) || element.classList.contains("paragraph-index"))
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
