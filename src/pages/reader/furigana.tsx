import { JpdbParseResponseWithNodes } from "../../epub/epubJpdb";
import { furiFromToken, furiToRuby } from "../../utils/util";

export async function AddFurigana(jpdb: JpdbParseResponseWithNodes) {
    const newNodes: Text[] = []

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
                    hasReplacement = true
                    // TODO would be better to do this in 1 step
                    // Sending the furi as a string can mess up
                    const furi = furiFromToken(nodeContent.substring(token[0] - nodeStart, token[0] + token[1] - nodeStart), token)
                    if (furi.includes("[")) {
                        replacement.push(furiToRuby(furi))
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