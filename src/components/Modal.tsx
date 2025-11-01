import IconButton from "./basic/IconButton";
import { Component } from "./Component";
import Loader, { DOMable } from "./Loader";

interface Props {
    header: any
    footer?: any
    onClose: () => void
    id?: string
    body: DOMable | Promise<DOMable> | ((body: HTMLElement) => Promise<DOMable>)
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

        let innerBody: DOMable
        if (typeof props.body === "string" || (typeof props.body !== "function" && !("then" in props.body))) {
            innerBody = props.body
        } else {
            if (typeof props.body === "function")
                props.body = props.body(body)
            innerBody = <Loader load={props.body} />
        }
        if (Array.isArray(innerBody))
            body.append(...innerBody)
        else
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
        if (props.id) res.id = props.id
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
        if (this.Node.id) OpenModals.find(e => e.Node.id === this.Node.id)?.Close()
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