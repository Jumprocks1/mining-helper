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
        if (loading) this.Node.classList.add("loading")
        else this.Node.classList.remove("loading")
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

    waitFor(maybePromise: unknown, canRetry: boolean) {
        if (maybePromise instanceof Promise) {
            this.Loading = true;
            this.Node.classList.add("loading")
            this.Node.classList.remove("errored")
            this.Node.tooltipError = undefined
            maybePromise.catch(error => {
                console.error({ message: "error in promise", error })
                const message = userErrorMessage(error)
                this.Node.classList.add("errored")
                this.Node.tooltipError = message
                if (!canRetry) this.Disabled = true
            }).then(() => {
                this.Loading = false;
                this.Node.classList.remove("loading")
            })
        }
    }

    constructor(props: LoadingButtonProps) {
        super()

        this.Node = <button />
        if (props.disabled) this.Disabled = true
        applyBaseComponentProps(this.Node, props)
        const eventName = props.onDown ? "mousedown" : "click"
        this.Node.addEventListener(eventName, ev => {
            if (this.Loading || this.Disabled) return
            if (this.Node.tooltipError) {
                this.Node.classList.remove("errored")
                this.Node.tooltipError = undefined
            }
            if (props.onClick) {
                try {
                    this.waitFor(props.onClick(ev), true)
                } catch (error: unknown) {
                    console.error(error)
                    const message = userErrorMessage(error)
                    this.Node.classList.add("errored")
                    this.Node.tooltipError = message
                }
            }
        })
        this.waitFor(props.loading, false)
    }
}
