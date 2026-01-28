import { JsPopover } from "../components/basic/JsPopover"
import { LoadableChildren } from "../components/Loader";

declare global {
    interface HTMLElement {
        tooltip?: LoadableChildren
        tooltipError?: LoadableChildren
        tooltipConfig?: TooltipConfig
    }
}

interface TooltipConfig {
    className?: string
}

export const SmallTooltip: TooltipConfig = {
    className: "small-tooltip",
}

class Tooltip extends JsPopover {
    constructor({ anchor, hydrate, config }: { anchor: HTMLElement, hydrate: LoadableChildren, config: TooltipConfig | undefined }) {
        super({
            type: "js-tooltip",
            anchor,
            hydrate
        })
        if (config) {
            if (config.className) {
                this.Node.classList.add(config.className)
            }
        }
    }
}

export function ActionTooltip(action: string, binding?: string, description?: string | (() => string)) {
    return () => <span className="action-tooltip">
        <div className="row">
            <span className="action">{action}</span>
            {binding && <span className="binding">{binding}</span>}
        </div>
        {description && <span className="description">{description}</span>}
    </span>
}

let currentTooltip: Tooltip | undefined

export function UpdateTooltip(el: HTMLElement) {
    if (!currentTooltip) {
        // this isn't perfect, but it's very close
        // main reason we need it is for errored buttons
        // if the button doesn't have a tooltip before the error, it won't get tracked by pointerover
        // this is the only real alternative
        if (el.matches(":hover")) show(el)
        return
    }
    if (currentTooltip && currentTooltip.Anchor === el) {
        const error = Boolean(el.tooltipError)
        const tooltip = error ? el.tooltipError : el.tooltip
        if (!tooltip) {
            hide()
            return
        }
        currentTooltip.SetContent(tooltip)
        if (error) currentTooltip.Node.classList.add("error-tooltip")
        else currentTooltip.Node.classList.remove("error-tooltip")
    }
}

function hide() {
    if (!currentTooltip) return
    currentTooltip.Close()
    currentTooltip = undefined
}

let tooltipDefaultConfig: TooltipConfig | undefined = undefined

function show(el: HTMLElement) {
    hide()
    const error = Boolean(el.tooltipError)
    currentTooltip = new Tooltip({
        anchor: el,
        hydrate: error ? el.tooltipError : el.tooltip,
        config: el.tooltipConfig ?? tooltipDefaultConfig
    })
    if (error) currentTooltip.Node.classList.add("error-tooltip")
    currentTooltip.Open()
}

let registered = false
export function RegisterTooltipEvents(defaultConfig: TooltipConfig | undefined = undefined) {
    if (registered) return
    registered = true
    tooltipDefaultConfig = defaultConfig

    function closestTooltip(el: HTMLElement | null): HTMLElement | undefined {
        do {
            if (!el) return
            if (el.tooltip || el.tooltipError) return el
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
        // mostly just nice for debugging
        if (ev.ctrlKey) return
        if (!currentTooltip) return
        if (ev.relatedTarget) {
            if (currentTooltip.Anchor!.contains(ev.relatedTarget as Node)) return
            if (currentTooltip.Node.contains(ev.relatedTarget as Node)) return
        }
        hide()
    })
}