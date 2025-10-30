import IconButton from "./basic/IconButton";
import { Component } from "./Component";

interface Props {
    header: any
    footer?: any
    onClose: () => void
    body: HTMLElement | string | ((body: HTMLElement) => Promise<(string | Node)[]>)
}

const OpenModals: Modal[] = []

let hooked = false
function hookListener() {
    if (hooked) return
    hooked = true
    document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            if (OpenModals.length > 0) {
                OpenModals[OpenModals.length - 1].Close()
            }
        }
    })
}

export class Modal extends Component {

    Node: HTMLElement

    IsOpen = false;

    OnClose: () => void

    constructor(props: Props) {
        super()
        this.OnClose = props.onClose

        const closeButton = <IconButton icon="close" onClick={() => this.Close()} />

        const body = <div className="body"></div>

        let innerBody: Node | string
        if (props.body instanceof Element || typeof props.body === "string") {
            innerBody = props.body
        } else {
            const loader = <div className="loader" />
            innerBody = loader
            props.body(body).then(e => loader.replaceWith(...e))
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
        res.onpointerdown = ev => {
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
        const index = OpenModals.indexOf(this)
        if (index >= 0) OpenModals.splice(index, 1)
        this._closeNoOnClose()
        // it's fine if OnClose calls this Close for some reason since the guard above will prevent a loop
        this.OnClose()
    }

    Open() {
        if (this.IsOpen) return
        hookListener()
        this.IsOpen = true
        OpenModals.push(this)
        document.body.append(this.Node)
    }
}


type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>
type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export function OpenModal(props: PartialBy<Props, "onClose">) {
    if (!props.onClose)
        props.onClose = () => { }
    const modal = new Modal(props as Props)
    modal.Open()
    return modal
}