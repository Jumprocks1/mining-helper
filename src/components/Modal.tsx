import IconButton from "./basic/IconButton";
import { Component } from "./Component";

interface Props {
    header: any
    footer?: any
    onClose: () => void
    body: HTMLElement | ((body: HTMLElement) => Promise<(string | Node)[]>)
}

export class Modal extends Component {

    Node: HTMLElement

    IsOpen = false;

    OnClose: () => void

    constructor(props: Props) {
        super()
        this.OnClose = props.onClose

        const closeButton = <IconButton icon="close" onClick={this.OnClose} />

        const body = <div className="body"></div>

        let innerBody: HTMLElement
        if (props.body instanceof Element) {
            innerBody = props.body
        } else {
            innerBody = <div className="loader" />
            props.body(body).then(e => innerBody.replaceWith(...e))
        }
        body.append(innerBody)

        const inner = <div className="inner-modal">
            <div className="header">
                <div>{props.header}</div>
                {closeButton}
            </div>
            {body}
            {props.footer && <div className="footer">{props.footer}</div>}
        </div>
        const res = <div className="modal">
            {inner}
        </div>
        res.onclick = ev => {
            if (ev.target === res) {
                this.Close()
            }
        }
        this.Node = res
    }

    // bit awkward but should be fine
    _closeNoOnClose() {
        if (!this.IsOpen) return
        this.IsOpen = false;
        this.Node.remove()
    }
    Close() {
        if (!this.IsOpen) return
        this._closeNoOnClose()
        // it's fine if OnClose calls this Close for some reason since the guard above will prevent a loop
        this.OnClose()
    }

    Open() {
        if (this.IsOpen) return
        this.IsOpen = true
        document.body.append(this.Node)
    }
}