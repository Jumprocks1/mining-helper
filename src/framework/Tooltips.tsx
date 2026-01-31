import { JsPopover } from "../components/basic/JsPopover"
import { LoadableChildren } from "../components/Loader";
import { getSettingSync } from "../views/SettingsModal";

declare global {
    interface HTMLElement {
        tooltip?: LoadableChildren
        tooltipError?: LoadableChildren
        tooltipConfig?: TooltipConfig
    }
}

interface TooltipConfig {
    className?: string
    delay?: number
}

export const SmallTooltip: TooltipConfig = {
    className: "small-tooltip",
}

class Tooltip extends JsPopover {
    Delayed?: number // timeout reference
    constructor({ anchor, hydrate, config }: { anchor: HTMLElement, hydrate: LoadableChildren, config: TooltipConfig | undefined }) {
        super({
            type: "js-tooltip",
            anchor,
            hydrate
        })
        // we still hydrate the tooltip even if this delay doesn't elapse
        // could fix in the future, but realistically it's fine
        const delay = config?.delay ?? getSettingSync("defaultTooltipDelay")
        if (delay > 0) {
            this.Node.classList.add("hide")
            this.Delayed = setTimeout(() => this.Node.classList.remove("hide"), delay)
        }
        if (config) {
            if (config.className) {
                this.Node.classList.add(config.className)
            }
        }
    }
    override Close() {
        if (this.Delayed !== undefined) {
            clearTimeout(this.Delayed)
            this.Delayed = undefined
        }
        super.Close()
    }
}

export function ActionTooltip(action: string, binding?: string, description?: string | (() => string)) {
    return () => <span className="action-tooltip">
        <div className="row">
            <span className="action">{action}</span>
            {binding && <kbd>{binding}</kbd>}
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

// think this is pretty safe, shouldn't leak memory
function watchTooltipProperty(el: HTMLElement) {
    const desc = Object.getOwnPropertyDescriptor(el, "tooltip")
    if (desc?.get) return

    let tooltip = el.tooltip
    Object.defineProperty(el, "tooltip", {
        enumerable: true,
        get: () => tooltip,
        set(value) {
            if (value === tooltip) return
            tooltip = value
            UpdateTooltip(el)
        }
    })

    let tooltipError = el.tooltipError
    Object.defineProperty(el, "tooltipError", {
        enumerable: true,
        get: () => tooltipError,
        set(value) {
            if (value === tooltipError) return
            tooltipError = value
            UpdateTooltip(el)
        }
    })
}

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
    watchTooltipProperty(el)
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
            if (currentTooltip.Node.contains(ev.relatedTarget as Node)) {
                if (ev.shiftKey) return
                // if we make it inside the tooltip while holding shift, don't hide it when moving around inside tooltip
                if (currentTooltip.Node.contains(ev.target as Node))
                    return
            }
        }
        hide()
    })
}