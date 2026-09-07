import { JpdbParseResponseWithNodes } from "../../epub/epubJpdb";
import { JpdbToken } from "../../jpdb/JpdbParseText";

export async function AddFurigana(jpdb: JpdbParseResponseWithNodes) {
    const newNodes: Text[] = []
    // This should no-op when everything is already inside ruby tags

    let tokenI = 0;
    let currentPos = 0
    for (const node of jpdb.nodes) {
        const nodeContent = node.textContent
        const nodeStart = currentPos
        const nodeEnd = nodeStart + nodeContent.length

        let hasReplacement = false
        let replacement: (string | Node | Text)[] = []
        function pushTo(pushTo: number) {
            if (currentPos === pushTo) return
            replacement.push(nodeContent.substring(currentPos - nodeStart, pushTo - nodeStart))
            currentPos = pushTo
        }
        if (!node.parentElement?.closest("ruby, rt")) {
            while (tokenI < jpdb.tokens.length) {
                const token = jpdb.tokens[tokenI]
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