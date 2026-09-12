export function getHoveredCharacterIndex(x: number, y: number) {
    const caretRange = document.caretPositionFromPoint(x, y)
    if (!caretRange) return

    const node = caretRange.offsetNode
    if (node.nodeType !== Node.TEXT_NODE) return

    const text = node.textContent
    if (!text) return

    const offset = caretRange.offset

    const testRange = document.createRange()
    let beforeRect: DOMRect | undefined = undefined
    if (offset > 0) {
        testRange.setStart(node, offset - 1)
        testRange.setEnd(node, offset)
        beforeRect = testRange.getBoundingClientRect()
    }

    let afterRect: DOMRect | undefined = undefined
    if (offset < text.length) {
        testRange.setStart(node, offset)
        testRange.setEnd(node, offset + 1)
        afterRect = testRange.getBoundingClientRect()
    }

    // not really sure if it's possible to have both of these
    // maybe if there's weird overlapping characters, but I think it's fine to prefer the left one in those cases

    // we extend the hitbox of these by 1 pixel to help prevent gaps
    // the gaps don't seem to happen for regular text nodes, but when there's furigana it's very common
    const hitBefore = inRect(x, y, beforeRect, 1)
    const hitAfter = inRect(x, y, afterRect, 1)
    const hitIndex = hitBefore ? offset - 1 : hitAfter ? offset : undefined
    // we can't return one of the hit nodes because the cursor can be very far away
    if (hitIndex === undefined) return undefined
    return [node, hitIndex] as const
}

function inRect(x: number, y: number, rect: DOMRect | undefined, epsilon: number) {
    if (!rect) return false
    return rect.left - epsilon <= x && rect.right + epsilon >= x && rect.top - epsilon <= y && rect.bottom + epsilon >= y
}

export function getCharacterIndex(parent: HTMLElement, node: Node, offset: number) {
    const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT, null);
    let current;
    let index = 0;
    while (current = walker.nextNode()) {
        if (current === node) return index + offset
        index += current.textContent!.length;
    }
    throw new Error("Node not found in parent")
}

export function getTextNodeAtIndex(parent: HTMLElement, offset: number) {
    const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT, null);
    let current;
    let remaining = offset;
    while (current = walker.nextNode()) {
        const length = current.textContent!.length
        if (remaining <= length) return [current, remaining] as const
        remaining -= length
    }
    throw new Error("Node not found in parent")
}

export function getSelectionRange(parent: HTMLElement, start: number, end: number) {
    const range = document.createRange()
    const startNode = getTextNodeAtIndex(parent, start)
    range.setStart(startNode[0], startNode[1])
    const endNode = getTextNodeAtIndex(parent, end)
    range.setEnd(endNode[0], endNode[1])
    return range
}

export function setSelection(parent: HTMLElement | null | undefined, start: number, end: number) {
    if (!parent) return
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    const startNode = getTextNodeAtIndex(parent, start)
    range.setStart(startNode[0], startNode[1])
    const endNode = getTextNodeAtIndex(parent, end)
    range.setEnd(endNode[0], endNode[1])
    selection.removeAllRanges()
    selection.addRange(range)
}

export function combineRectangles(rects: DOMRect[] | DOMRectList) {
    if (rects.length === 1) return rects
    const o: DOMRect[] = []
    for (const a of rects) {
        let found = false
        for (let i = 0; i < o.length; i++) {
            const b = o[i]
            if (a.y === b.y && a.height === b.height
                && a.left <= b.right && b.left <= a.right
            ) {
                const x = Math.min(a.left, b.left)
                o[i] = new DOMRect(x, a.y, Math.max(a.right, b.right) - x, a.height)
                found = true
                break
            }
        }
        if (!found) {
            o.push(a)
        }
    }
    return o
}

export function getTextRects(target: HTMLElement | Range) {
    if (target instanceof HTMLElement) return combineRectangles(target.getClientRects())
    else {
        return combineRectangles(getTextRectsRange(target))
    }
}

export function getTextRectsRange(range: Range) {
    // This walks all text nodes in the common ancestor for `range`, skipping <rt>
    // For each node that overlaps the range, it select the part of the node inside of the input range
    // It then adds that text node's range to the output
    const rects: DOMRect[] = []

    function handle(text: Text) {
        const nodeRange = document.createRange()
        nodeRange.selectNodeContents(text)

        // Skip ranges with no overlap
        if (range.compareBoundaryPoints(Range.END_TO_START, nodeRange) >= 0 ||
            range.compareBoundaryPoints(Range.START_TO_END, nodeRange) <= 0)
            return

        if (text === range.startContainer)
            nodeRange.setStart(text, range.startOffset)
        if (text === range.endContainer)
            nodeRange.setEnd(text, range.endOffset)
        rects.push(...nodeRange.getClientRects())
    }

    const parent = range.commonAncestorContainer
    if (parent instanceof Text) {
        handle(parent)
        return rects
    }

    const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
        if (node.parentElement?.closest("rt"))
            continue
        handle(node as Text)
    }

    return rects;
}