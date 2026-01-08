import { appendChild, type Children } from "../../framework/createElement";
import { Component } from "../../framework/Component";

interface Props {
    side: "below"
    position: "absolute" | "fixed"
}

export class Popover extends Component {
    Node = <div className="popover">

    </div>

    constructor(props: Props) {
        super()

        this.Node.style.position = props.position

        // TODO should probably listen for escape key
    }

    SetContent(children: Children) {
        this.Node.replaceChildren()
        appendChild(this.Node, children)
    }

    Show(x: number, y: number) {
        this.Node.classList.remove("hide")
        this.Node.style.left = x + "px"
        this.Node.style.top = y + "px"
    }

    Hide() {
        this.Node.classList.add("hide")
    }

    get Visible() {
        return !this.Node.classList.contains("hide")
    }

    Remove() {
        this.Node.remove()
    }
}