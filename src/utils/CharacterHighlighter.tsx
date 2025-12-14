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
    const hitBefore = beforeRect && beforeRect.left <= x && beforeRect.right >= x && beforeRect.top <= y && beforeRect.bottom >= y
    const hitAfter = afterRect && afterRect.left <= x && afterRect.right >= x && afterRect.top <= y && afterRect.bottom >= y

    const hitIndex = hitBefore ? offset - 1 : hitAfter ? offset : undefined
    if (hitIndex === undefined) return
    return [node, hitIndex] as const
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