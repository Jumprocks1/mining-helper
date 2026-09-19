import { FuriganaMode, getSetting, getSettingAndCache } from "../../core/Settings";
import { JpdbParseResponseWithNodes } from "../../reader/readerPageJpdb";
import { JpdbToken, JpdbVocabulary } from "../../jpdb/JpdbParseText";
import { getVocabState, VocabState } from "../../jpdb/JpdbState";
import { UnicodeCharacterType, unicodeType } from "../../utils/AnkiUtil";
import { loadAnkiKanjiSet } from "../../utils/KanjiSet";
import { furiToRuby } from "../../utils/util";

// This should no-op when everything is already inside ruby tags
export async function AddFurigana(jpdb: JpdbParseResponseWithNodes) {
    const mode = await getSetting("furiganaMode")
    if (mode === "none") return
    const knownAnkiKanji = await loadAnkiKanjiSet()
    const extraKanji = await getSetting("knownKanji")
    let knownKanji = knownAnkiKanji
    if (extraKanji.length > 0) {
        knownKanji = new Set<string>(knownAnkiKanji)
        for (const e of extraKanji) knownKanji.add(e)
    }
    const newNodes: Text[] = []
    const unknownTokens = jpdb.tokens.filter(e => needsFurigana(mode, e, jpdb.vocabulary[e[3]], knownKanji))

    // const knownTokens = jpdb.tokens.filter(e => e[2] && !needsFurigana(e, jpdb.vocabulary[e[3]], knownKanji)).length
    // console.log(`${knownTokens} / ${unknownTokens.length + knownTokens} / ${jpdb.tokens.length}`)


    let tokenI = 0;
    let currentPos = 0
    for (const node of jpdb.nodes) {
        const nodeContent = node.textContent
        const nodeStart = currentPos
        const nodeEnd = nodeStart + nodeContent.length

        let hasReplacement = false
        let replacement: (string | Node)[] = []
        function pushTo(pushTo: number) {
            if (currentPos === pushTo) return
            replacement.push(nodeContent.substring(currentPos - nodeStart, pushTo - nodeStart))
            currentPos = pushTo
        }
        if (!node.parentElement?.closest("ruby, rt")) {
            while (tokenI < unknownTokens.length) {
                const token = unknownTokens[tokenI]
                if (token[0] + token[1] > nodeEnd) {
                    // We stop trying to add furigana if the end of the next token is outside of this node
                    // Even if the token starts inside us, we don't try to do a cross-node furigana
                    break
                }
                if (token[0] >= nodeStart) {
                    pushTo(token[0])
                    const tokenWord = nodeContent.substring(token[0] - nodeStart, token[0] + token[1] - nodeStart)
                    const ruby = rubyFuriFromToken(tokenWord, token)
                    if (ruby) {
                        hasReplacement = true
                        replacement.push(...ruby)
                        currentPos = token[0] + token[1]
                    }
                }
                tokenI += 1
            }
        }
        pushTo(nodeEnd)
        if (hasReplacement) {
            for (let i = 0; i < replacement.length; i++) {
                const e = replacement[i]
                if (typeof e === "string") {
                    const t = document.createTextNode(e)
                    replacement[i] = t
                    newNodes.push(t)
                }
                else {
                    const walker = document.createTreeWalker(e, NodeFilter.SHOW_TEXT)
                    let node: Text | null
                    while (node = walker.nextNode() as Text | null) {
                        if (node.parentElement?.tagName !== "RT") {
                            newNodes.push(node)
                        }
                    }
                }
            }
            node.replaceWith(...replacement)
        } else newNodes.push(node)
    }

    // this recalculates the text node positions after we butcher the nodes with furigana
    // since the furigana shouldn't modify the string for jpdb, this should work fine
    jpdb.nodes = newNodes
}

function needsFurigana(mode: FuriganaMode, token: JpdbToken, vocab: JpdbVocabulary, knownKanji: Set<string>) {
    // As this is currently setup, requires a the vocab to be in our audio deck and all the kanji to be in the kanji deck
    const reading = token[2] // if there's no reading from jpdb, we always say "no furi needed"
    if (mode === "none" || !reading) return false
    if (mode === "always") return true
    const unknownVocab = mode === "kanjiOrVocab" || mode === "unknownVocab"
    const unknownKanji = mode === "kanjiOrVocab" || mode === "unknownKanji"

    // we could probably do all this without the `token` parameter, but this feels nice
    if (unknownKanji) {
        for (let i = 0; i < reading.length; i++) {
            if (!Array.isArray(reading[i])) continue
            const kanji = reading[i][0]
            // This loop is because some readings are compound (今日[きょう])
            for (let i = 0; i < kanji.length; i++) {
                const c = kanji[i]
                if (unicodeType(c) === UnicodeCharacterType.Kanji && !knownKanji.has(c))
                    return true
            }
        }
    }
    if (unknownVocab) {
        const vocabState = getVocabState(vocab, { trimKana: true })
        if (vocabState === VocabState.New) return true
    }
    return false
}

export function rubyFuriFromToken(word: string, token: JpdbToken) {
    if (Array.isArray(token[2])) {
        let i = 0
        let o: (Node | string)[] = []
        for (const reading of token[2]) {
            if (Array.isArray(reading)) {
                const ruby = document.createElement("ruby")
                ruby.className = "ruby-auto-gen"
                ruby.append(reading[0])
                i += reading[0].length
                const rt = document.createElement("rt")
                rt.innerText = reading[1]
                ruby.append(rt)
                o.push(ruby)
            } else {
                o.push(reading)
                i += reading.length
            }
        }
        if (i < word.length) o.push(word.substring(i))
        return o
    }
}

export async function addFuriganaOverrides(node: HTMLElement) {
    const overrides = Object.entries(await getSettingAndCache("furiganaOverrides"))
    if (overrides.length === 0) return

    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
        acceptNode: node => {
            // If node already has ruby (from source), skip
            if (node.nodeName === "RUBY") return NodeFilter.FILTER_REJECT
            return NodeFilter.FILTER_ACCEPT
        }
    })
    let currentNode = walker.nextNode() as Text | null
    while (currentNode) {
        const value = currentNode.nodeValue
        if (!value) continue

        let replacements: [start: number, [string, string]][] = []
        for (const entry of overrides) {
            const found = value.indexOf(entry[0])
            if (found >= 0) replacements.push([found, entry])
        }
        if (replacements.length > 0) {
            replacements.sort((a, b) => a[0] - b[0])
            let i = 0
            const o: (string | Node | Text)[] = []
            for (const r of replacements) {
                if (i > r[0]) continue // overlapping replacements
                const entry = r[1]
                o.push(value.substring(0, r[0]))
                const ruby = furiToRuby(entry[1])
                ruby.classList.add("furigana-override")
                o.push(ruby)
                i = r[0] + entry[0].length
            }
            o.push(value.substring(i))
            const t = currentNode
            currentNode = walker.nextNode() as Text | null // have to get next node before replacing
            t.replaceWith(...o)
        } else {
            currentNode = walker.nextNode() as Text | null
        }
    }
}