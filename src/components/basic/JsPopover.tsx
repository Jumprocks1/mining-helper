import { replaceChildren, type Children } from "../../framework/createElement";
import { Component } from "../../framework/Component";
import { Load, LoadableChildren } from "../Loader";
import { applyBaseComponentProps, BaseComponentProps } from "../../framework/util";

interface Props extends BaseComponentProps {
    hydrate?: () => Promise<Children> | Children
    anchor?: HTMLElement
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

// TODO unify with `Popover`, `HtmlPopover` and maybe `Modal`
// only real benefit of this over HtmlPopover is HtmlPopover requires the popover to exist in the DOM ahead of time
// this also puts popovers in a portal
export class JsPopover extends Component {
    Node = <div className="popover js-popover" />

    Hydrated = false
    IsOpen = false
    Hydrate?: () => Promise<Children> | Children

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

    constructor(props: Props) {
        super()
        this.Hydrate = props.hydrate
        this.Anchor = props.anchor
        applyBaseComponentProps(this.Node, props)
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
    Observer: MutationObserver | undefined
    Open() {
        if (this.IsOpen) return
        this.IsOpen = true

        // TODO need to bind escape/clickaway
        this.Update()
        // in the auto open case, the anchor might not be in the DOM (since it likely gets added shortly after Open is called)
        // will fix that when/if it comes up
        if (!this.IsOpen) throw new Error("Popover immediately closed, likely due to disconnected anchor")
        if (this.Anchor) {
            this.Observer = new MutationObserver(() => this.Update())
            // kinda sucks we observe the entire document, but just listening on the parent doesn't work
            // issue is if multiple parents up is removed, it wouldn't trigger any events lower down
            this.Observer.observe(document, { childList: true, subtree: true })
        }
        getPortal().append(this.Node)

        if (this.Hydrated || !this.Hydrate) return
        this.Hydrated = true
        this.SetContent(this.Hydrate)
    }
    Close() {
        if (!this.IsOpen) return
        this.IsOpen = false
        this.Node.remove()
        if (this.Observer) {
            this.Observer.disconnect()
            this.Observer = undefined
        }
    }
}