import { applyBaseComponentProps, BaseComponentProps } from "../framework/util";
import { userErrorMessage } from "../utils/UserError";
import { Component } from "../framework/Component"

export interface LoadingButtonProps extends BaseComponentProps {
    onClick?: (ev: MouseEvent) => unknown, // can return promise
    // Will show as loading initially until loading promise finishes
    loading?: Promise<any>
    disabled?: boolean
    onDown?: boolean
}

// Also catches errors nicely
export default class LoadingButton extends Component {
    Node: HTMLElement;

    _loading = false

    set Loading(loading: boolean) {
        if (this._loading === loading) return
        this._loading = loading
        this.Node.classList.toggle("loading", loading)
    }

    get Loading() { return this._loading }

    _disabled = false
    set Disabled(disabled: boolean) {
        if (this._disabled === disabled) return
        this._disabled = disabled
        if (disabled) this.Node.classList.add("disabled")
        else this.Node.classList.remove("disabled")
    }
    get Disabled() { return this._disabled }

    private pendingPromise?: Promise<unknown>
    waitFor(maybePromise: unknown, canRetry: boolean) {
        if (maybePromise instanceof Promise) {
            this.pendingPromise = maybePromise
            this.Loading = true;
            this.Node.classList.add("loading")
            this.Node.classList.remove("errored")
            this.Node.tooltipError = undefined
            return maybePromise.catch(error => {
                console.error({ message: "error in promise", error })
                const message = userErrorMessage(error)
                this.Node.classList.add("errored")
                this.Node.tooltipError = message
                if (!canRetry) this.Disabled = true
            }).then(() => {
                this.Loading = false;
                this.Node.classList.remove("loading")
                this.pendingPromise = undefined
            })
        }
    }

    Click(ev: MouseEvent | undefined) {
        if (this.Loading || this.Disabled) return this.pendingPromise
        if (this.Node.tooltipError) {
            this.Node.classList.remove("errored")
            this.Node.tooltipError = undefined
        }
        if (this.onClick) {
            return this.waitFor(this.onClick(ev ?? new MouseEvent("click")), true)
        }
    }

    private onClick: LoadingButtonProps["onClick"]

    constructor(props: LoadingButtonProps) {
        super()

        this.Node = <button />
        if (props.disabled) this.Disabled = true
        applyBaseComponentProps(this.Node, props)
        const eventName = props.onDown ? "mousedown" : "click"
        this.onClick = props.onClick
        this.Node.addEventListener(eventName, ev => this.Click(ev))
        this.waitFor(props.loading, false)
    }
}
