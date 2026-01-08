import { appendChild, type Children } from "../../framework/createElement";
import { Component } from "../../framework/Component";
import Loader from "../Loader";

interface Props {
    hydrate: () => Promise<Children> | Children
    className?: string
}

export class HtmlPopover extends Component {
    Node = <div className="popover" popover="auto" />

    Hydrated = false

    constructor(props: Props) {
        super()
        if (props.className) this.Node.classList.add(props.className)
        this.Node.addEventListener("beforetoggle", () => {
            if (this.Hydrated) return
            this.Hydrated = true
            const hydrate = props.hydrate()
            if (hydrate instanceof Promise) {
                this.SetContent(<Loader load={hydrate} />)
            } else {
                this.SetContent(hydrate)
            }
        })
    }

    SetContent(children: Children) {
        this.Node.replaceChildren()
        appendChild(this.Node, children)
    }

    Remove() {
        this.Node.remove()
    }

    Toggle(source?: HTMLElement) {
        // @ts-expect-error source doesn't show in the type def
        this.Node.togglePopover({ source })
    }
    Close() {
        this.Node.hidePopover()
    }
}