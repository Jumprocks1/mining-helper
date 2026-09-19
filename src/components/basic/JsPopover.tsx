import { replaceChildren } from "../../framework/createElement";
import { Component } from "../../framework/Component";
import { Load, LoadableChildren } from "../Loader";
import { applyBaseComponentProps, BaseComponentProps } from "../../framework/util";
import { onDeath } from "../../framework/Observer";
import { addRouteChangeListener } from "../../framework/Router";

interface Props extends BaseComponentProps {
    hydrate?: LoadableChildren
    anchor?: HTMLElement
    type: PopoverType
}

let portal: HTMLElement | undefined
let nextId = 0 // used for CSS anchor names

export function getPortal() {
    if (!portal) {
        portal = <div id="popover-portal" />
        document.body.append(portal)
    }
    return portal
}

type Closable = { Close: () => void, Node: HTMLElement, CloseOnClickaway?: boolean }
export const OpenPopovers: Closable[] = []

let hooked = false
export function TrackOpenPopover(popover: Closable) {
    OpenPopovers.push(popover)
    if (hooked) return
    hooked = true
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            if (OpenPopovers.length > 0) {
                OpenPopovers[OpenPopovers.length - 1].Close()
                e.stopImmediatePropagation()
            }
        }
    })
    document.addEventListener("pointerdown", e => {
        const target = e.target as Node
        if (!target) return
        for (let i = OpenPopovers.length - 1; i >= 0; i--) {
            const popover = OpenPopovers[i]
            if (popover.CloseOnClickaway && !popover.Node.contains(target)) {
                popover.Close()
            }
        }
    })
    addRouteChangeListener(() => {
        while (OpenPopovers.length > 0) OpenPopovers[OpenPopovers.length - 1].Close()
    })
}
export function MarkPopoverClosed(popover: Closable) {
    const index = OpenPopovers.indexOf(popover)
    if (index >= 0) OpenPopovers.splice(index, 1)
}

type PopoverType = "modal" | "js-tooltip" | "menu" | "info-popup"

// TODO maybe unify with `Modal`
// main benefits of JsPopover vs CSS:
//   lazy initialization
//   custom placement (eventually)
//   death tracking - CSS didn't really need this though
//   portal (allowing styles to be separte, good and bad)
//   general flexibility (CSS was causing issues when I wanted to add features, it was not possible)
export class JsPopover extends Component {
    Node = <div className="popover js-popover" />

    Hydrated = false
    IsOpen = false
    Hydrate?: LoadableChildren
    Type: PopoverType

    private _anchor?: HTMLElement
    public get Anchor() { return this._anchor }
    public set Anchor(anchor: HTMLElement | undefined) {
        this._anchor = anchor
        if (anchor) {
            let anchorName = anchor.style.getPropertyValue("anchor-name")
            if (!anchorName) anchor.style.setProperty("anchor-name", anchorName = `--js-popover-${nextId++}`)
            this.Node.style.setProperty("position-anchor", anchorName)
        }
    }
    private Range?: Range

    get CloseOnClickaway() { return this.Type === "menu" || this.Type === "info-popup" }

    constructor(props: Props) {
        super()
        this.Hydrate = props.hydrate
        this.Anchor = props.anchor
        this.Type = props.type
        applyBaseComponentProps(this.Node, props)
        this.Node.classList.add(props.type)
        this.Node.classList.add("default-position")
    }

    SetContent(children: LoadableChildren) {
        replaceChildren(this.Node, Load(children))
    }
    AnchorToRange(range: Range) {
        if (!this.Anchor) {
            let anchor: Node | null = range.commonAncestorContainer
            if (!(anchor instanceof HTMLElement)) anchor = anchor.parentElement
            if (!anchor) return
            const htmlAnchor = anchor as HTMLElement
            this.Anchor = htmlAnchor
        }
        this.Range = range
        const defaultPos = this.Anchor.getBoundingClientRect()
        const desiredPos = range.getBoundingClientRect()
        this.Node.style.left = `calc(anchor(left) + ${desiredPos.left - defaultPos.left}px)`
        this.Node.style.top = `calc(anchor(top) + ${desiredPos.bottom - defaultPos.top}px)`
    }

    Toggle() {
        if (this.IsOpen) this.Close()
        else this.Open()
    }
    Update() {
        if (!this.IsOpen) return
        if (!this._anchor) return // fullscreen modals won't have an anchor
        if (!this._anchor.isConnected) {
            this.Close()
            return
        }
    }
    Open() {
        if (this.IsOpen) return
        TrackOpenPopover(this)
        this.IsOpen = true

        this.Update()
        // in the auto open case, the anchor might not be in the DOM (since it likely gets added shortly after Open is called)
        // will fix that when/if it comes up
        if (!this.IsOpen) throw new Error("Popover immediately closed, likely due to disconnected anchor")
        if (this.Anchor) onDeath(this.Anchor, () => this.Update())
        getPortal().append(this.Node)

        if (this.Hydrated || !this.Hydrate) return
        this.Hydrated = true
        this.SetContent(this.Hydrate)
    }
    Close() {
        if (!this.IsOpen) return
        MarkPopoverClosed(this)

        this.IsOpen = false
        this.Node.remove()
    }

    // not called automatically
    // ideally it's called when opened, content changed, or position changed (including anchor/scroll position)
    FixPosition() {
        // If we aren't anchoring to a range, there's nothing to fix
        // CSS should automatically reposition as long as left/top aren't set
        if (!this.Range || !this.Anchor || !this.IsOpen) return

        // Could add an intersection observer if we ever have tooltips that change size
        // Think that's overkill for now though
        const pos = this.Node.getBoundingClientRect()
        const windowWidth = document.documentElement.clientWidth
        const windowHeight = document.documentElement.clientHeight
        let xShift = 0
        if (pos.right > windowWidth) {
            xShift = windowWidth - pos.right
        } else if (pos.left < 0) {
            // this one shouldn't happen since we are currently always spanning right
            xShift = pos.left
        }
        // We don't bother checking the other condition for y direction since it should never happen
        const flipY = pos.bottom > windowHeight
        if (xShift !== 0 || flipY) {
            const defaultPos = this.Anchor.getBoundingClientRect()
            const desiredPos = this.Range.getBoundingClientRect()
            this.Node.style.left = `calc(anchor(left) + ${desiredPos.left - defaultPos.left + xShift}px)`
            if (flipY) {
                const newTop = defaultPos.top + desiredPos.bottom - defaultPos.top - pos.height - desiredPos.height
                if (newTop < 0)
                    // if flipping it flies off the top anyways, keep it the normal direction
                    this.Node.style.top = `calc(anchor(top) + ${desiredPos.bottom - defaultPos.top}px)`
                else
                    // it would make more sense to set style.bottom but I was having issues with that
                    this.Node.style.top = `calc(anchor(top) + ${desiredPos.bottom - defaultPos.top - pos.height - desiredPos.height}px)`
            } else this.Node.style.top = `calc(anchor(top) + ${desiredPos.bottom - defaultPos.top}px)`
        }
    }
}