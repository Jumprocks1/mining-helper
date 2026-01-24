import IconButton from "./basic/IconButton";
import { Component } from "../framework/Component";
import Loader from "./Loader";
import { getPortal } from "./basic/JsPopover";
import { appendChild, Children } from "../framework/createElement";

interface Props {
    header: any
    footer?: any
    onClose: () => void
    id?: string
    body: Children | Promise<Children> | ((body: HTMLElement) => (Promise<Children> | Children))
    getMinimizeTarget?: () => DOMRect | undefined // if supplied, allow minimize
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

    IsMinimized = false;
    MinimizeButton?: HTMLElement

    getMinimizeTarget?: Props["getMinimizeTarget"]

    OnCloseHandlers?: (() => void)[]
    RegisterOnClose(onClose: () => void) {
        if (!this.IsOpen) {
            onClose() // invoke immediately, important for things like disposing memory
            return
        }
        this.OnCloseHandlers ??= []
        this.OnCloseHandlers.push(onClose)
    }

    constructor(props: Props) {
        super()
        this.OnClose = props.onClose

        const closeButton = <IconButton icon="close" onClick={() => this.Close()} />

        const body = <div className="body"></div>

        let innerBody = typeof props.body === "function" ? props.body(body) : props.body
        if (innerBody instanceof Promise) {
            innerBody = <Loader load={innerBody} />
        }

        appendChild(body, innerBody as any)

        if (props.getMinimizeTarget) {
            this.getMinimizeTarget = props.getMinimizeTarget
            this.MinimizeButton = <IconButton icon="minimize" onClick={() => {
                if (!this.IsMinimized) {
                    this.Minimize()
                } else {
                    this.MinimizeButton!.textContent = "minimize"
                    this.IsMinimized = false
                    res.classList.remove("minimized")
                    res.style.removeProperty("left")
                    res.style.removeProperty("top")
                    res.style.removeProperty("width")
                    res.style.removeProperty("height")
                }
            }} />
        }

        const inner = <div className="inner-modal">
            <div className="header">
                <div>{props.header}</div>
                {this.MinimizeButton}
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
    // main reason is so sub-classes can have extra return values in OnClose
    _closeNoOnClose() {
        if (!this.IsOpen) return
        this.IsOpen = false;
        this.Node.remove()
        if (this.OnCloseHandlers) {
            this.OnCloseHandlers.forEach(e => e())
            this.OnCloseHandlers = undefined
        }
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
        getPortal().append(this.Node)
    }

    Minimize() {
        if (this.IsMinimized) return
        const rect = this.getMinimizeTarget?.()
        if (rect) {
            if (this.MinimizeButton) this.MinimizeButton.textContent = "maximize"
            this.IsMinimized = true
            this.Node.classList.add("minimized")
            this.Node.style.left = rect.x + "px"
            this.Node.style.top = rect.y + "px"
            this.Node.style.width = rect.width + "px"
            this.Node.style.height = rect.height + "px"
        }
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