import { replaceChildren, type Children } from "../../framework/createElement";
import { Component } from "../../framework/Component";
import { Load, LoadableChildren } from "../Loader";
import { applyBaseComponentProps, BaseComponentProps } from "../../framework/util";
import { onDeath } from "../../framework/Observer";

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
}
export function MarkPopoverClosed(popover: Closable) {
    const index = OpenPopovers.indexOf(popover)
    if (index >= 0) OpenPopovers.splice(index, 1)
}

// TODO feed modals through here
type PopoverType = "modal" | "tooltip" | "menu"

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

    get CloseOnClickaway() { return this.Type === "menu" }

    constructor(props: Props) {
        super()
        this.Hydrate = props.hydrate
        this.Anchor = props.anchor
        this.Type = props.type
        applyBaseComponentProps(this.Node, props)
        this.Node.classList.add(props.type)
    }

    SetContent(children: LoadableChildren) {
        replaceChildren(this.Node, Load(children))
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

        // TODO need to bind escape/clickaway
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
}