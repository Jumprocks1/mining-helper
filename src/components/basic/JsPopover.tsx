import { appendChild, type Children } from "../../framework/createElement";
import { Component } from "../../framework/Component";
import Loader from "../Loader";
import { applyBaseComponentProps, BaseComponentProps } from "../../framework/util";

interface Props extends BaseComponentProps {
    hydrate: () => Promise<Children> | Children
    anchor?: HTMLElement
}

let portal: HTMLElement | undefined
let nextId = 0 // used for CSS anchor names

export function getPortal() {
    portal ??= <div id="popover-portal" />
    // TODO this gets deleted on page navigations (which are rare within a modal)
    // causes some weird issues, especially if you open a different modal since the old modal doesn't close on page navigation
    if (!portal.isConnected) document.body.append(portal)
    return portal
}

// TODO unify with `Popover`, `HtmlPopover` and maybe `Modal`
// only real benefit of this over HtmlPopover is HtmlPopover requires the popover to exist in the DOM ahead of time
// this also puts popovers in a portal
export class JsPopover extends Component {
    Node = <div className="popover js-popover" />

    Hydrated = false
    IsOpen = false
    Hydrate: () => Promise<Children> | Children
    Anchor?: HTMLElement

    constructor(props: Props) {
        super()
        this.Hydrate = props.hydrate
        this.Anchor = props.anchor
        if (this.Anchor) {
            let anchorName = this.Anchor.style.getPropertyValue("anchor-name")
            if (!anchorName) this.Anchor.style.setProperty("anchor-name", anchorName = `--js-popover-${nextId++}`)
            this.Node.style.setProperty("position-anchor", anchorName)
        }
        applyBaseComponentProps(this.Node, props)
    }

    SetContent(children: Children) {
        this.Node.replaceChildren()
        appendChild(this.Node, children)
    }

    Toggle() {
        if (this.IsOpen) this.Close()
        else this.Open()
    }
    Update() {
        if (!this.IsOpen) return
        if (!this.Anchor) return // fullscreen modals won't have an anchor
        if (!this.Anchor.isConnected) {
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

        if (this.Hydrated) return
        this.Hydrated = true
        const hydrate = this.Hydrate()
        if (hydrate instanceof Promise) {
            this.SetContent(<Loader load={hydrate} />)
        } else {
            this.SetContent(hydrate)
        }
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