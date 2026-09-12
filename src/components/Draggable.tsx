import { Icon } from "./basic/IconButton"

interface Props {
    onStart?: (x: number, y: number) => void
    onMove?: (dx: number, dy: number) => void
    onDrop?: (dx: number, dy: number) => void
    remember?: boolean
    onDoubleClick?: () => void
}

export default (props: Props) => {
    const icon = <Icon className="draggable" icon="drag_indicator" />
    let x: number | undefined = undefined
    let y: number | undefined = undefined
    let dragging = false
    icon.addEventListener("pointerdown", ev => {
        icon.setPointerCapture(ev.pointerId)
        dragging = true
        if (x === undefined || !props.remember) {
            x = ev.clientX
            y = ev.clientY
        }
        props.onStart?.(x, y!)
        icon.classList.add("dragging")
    })
    const move = (ev: PointerEvent) => {
        if (!dragging || !icon.hasPointerCapture(ev.pointerId)) return
        const dx = ev.clientX - x!
        const dy = ev.clientY - y!
        props.onMove?.(dx, dy)
    }
    icon.addEventListener("pointermove", move)
    if (props.onDoubleClick) icon.addEventListener("dblclick", props.onDoubleClick)
    const up = (ev: PointerEvent) => {
        icon.releasePointerCapture(ev.pointerId)
        if (!dragging) return
        dragging = false
        const dx = ev.clientX - x!
        const dy = ev.clientY - y!
        props.onDrop?.(dx, dy)
        icon.classList.remove("dragging")
    }
    icon.addEventListener("pointerup", up)
    return icon
}