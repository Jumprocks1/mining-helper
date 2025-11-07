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
