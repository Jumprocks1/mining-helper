import { JsPopover } from "../components/basic/JsPopover"
import { LoadableChildren } from "../components/Loader";

declare global {
    interface HTMLElement {
        tooltip?: LoadableChildren
    }
}

interface HasTooltip extends HTMLElement {
    tooltip: LoadableChildren
}

class Tooltip extends JsPopover {
    constructor({ anchor, hydrate }: { anchor: HTMLElement, hydrate: LoadableChildren }) {
        super({
            type: "tooltip",
            anchor,
            hydrate
        })
    }
}

let registered = false
export function RegisterTooltipEvents() {
    if (registered) return
    registered = true

    let currentTooltip: Tooltip | undefined

    function show(el: HasTooltip) {
        currentTooltip = new Tooltip({
            anchor: el,
            hydrate: el.tooltip
        })
        currentTooltip.Open()
    }
    function hide() {
        if (!currentTooltip) return
        currentTooltip.Close()
        currentTooltip = undefined
    }

    function closestTooltip(el: HTMLElement | null): HasTooltip | undefined {
        do {
            if (!el) return
            if (el.tooltip) return el as HasTooltip
        } while (el = el.parentNode as HTMLElement | null)
    }

    document.addEventListener("pointerover", e => {
        const target = e.target
        if (!(target instanceof HTMLElement)) return
        const tooltipElement = closestTooltip(target)
        if (!tooltipElement || tooltipElement === currentTooltip?.Anchor) return
        show(tooltipElement)
    })
    document.addEventListener("pointerout", ev => {
        if (!currentTooltip) return
        if (ev.relatedTarget && currentTooltip.Anchor!.contains(ev.relatedTarget as Node)) return
        // may need to allow hovering nested tooltips here eventually
        hide()
    })
}