import { userErrorMessage } from "../utils/UserError";
import { Component } from "./Component"

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

    waitFor(promise: Promise<any> | void, canRetry: boolean) {
        if (promise) {
            this.Loading = true;
            this.Node.classList.add("loading")
            this.Node.classList.remove("errored")
            promise.catch(error => {
                // TODO should put a little notice on the button
                // Will need some sort of `allowRetry` property since an initial load failure can't retry
                console.error({ message: "error in promise", error })
                const message = userErrorMessage(error)
                this.Node.classList.add("errored")
                this.Node.dataset.error = message
                if (!canRetry) this.Disabled = true
            }).then(() => {
                this.Loading = false;
                this.Node.classList.remove("loading")
            })
        }
    }

    constructor(props: {
        onClick: () => Promise<void> | void,
        // Will show as loading initially until loading promise finishes
        loading?: Promise<any>
        className?: string
    }) {
        super()

        this.Node = <button />
        if (props.className) this.Node.classList.add(props.className)

        this.Node.addEventListener("click", () => {
            if (this.Loading || this.Disabled) return
            this.waitFor(props.onClick(), true)
        })
        this.waitFor(props.loading, false)
    }
}
