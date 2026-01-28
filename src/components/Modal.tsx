import IconButton from "./basic/IconButton";
import { Component } from "../framework/Component";
import { Load, LoadableChildren } from "./Loader";
import { getPortal, TrackOpenPopover, OpenPopovers, MarkPopoverClosed as MarkPopoverClosed } from "./basic/JsPopover";
import { appendChild } from "../framework/createElement";
import { applyBaseComponentProps, BaseComponentProps } from "../framework/util";

export interface ModalProps extends BaseComponentProps {
    header: any
    footer?: LoadableChildren
    onClose: () => void
    body: LoadableChildren<HTMLElement>
    getMinimizeTarget?: () => DOMRect | undefined // if supplied, allow minimize
}

export class Modal extends Component {

    Node: HTMLElement

    IsOpen = false;

    OnClose: () => void

    IsMinimized = false;
    MinimizeButton?: HTMLElement

    getMinimizeTarget?: ModalProps["getMinimizeTarget"]

    OnCloseHandlers?: (() => void)[]
    RegisterOnClose(onClose: () => void) {
        if (!this.IsOpen) {
            onClose() // invoke immediately, important for things like disposing memory
            return
        }
        this.OnCloseHandlers ??= []
        this.OnCloseHandlers.push(onClose)
    }

    constructor(props: ModalProps) {
        super()
        this.OnClose = props.onClose

        const closeButton = <IconButton icon="close" onClick={() => this.Close()} />


        const body = <div className="body"></div>
        const inner = <div className="inner-modal">
            <div className="header">
                <div>{props.header}</div>
                {this.MinimizeButton}
                {closeButton}
            </div>
            {body}
            {props.footer && <div className="footer">{Load(props.footer)}</div>}
        </div>

        appendChild(body, Load(props.body, inner))

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

        const res = <div className="modal">
            {inner}
        </div>
        res.onpointerdown = ev => {
            if (ev.target === res) {
                this.Close()
            }
        }
        applyBaseComponentProps(res, props)
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
        MarkPopoverClosed(this)
        this._closeNoOnClose()
        // it's fine if OnClose calls this Close for some reason since the guard above will prevent a loop
        this.OnClose()
    }

    Open() {
        if (this.IsOpen) return
        if (this.Node.id) OpenPopovers.find(e => e.Node?.id === this.Node.id)?.Close()
        TrackOpenPopover(this)
        this.IsOpen = true
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

export function OpenModal(props: PartialBy<ModalProps, "onClose">) {
    if (!props.onClose)
        props.onClose = () => { }
    const modal = new Modal(props as ModalProps)
    modal.Open()
    return modal
}