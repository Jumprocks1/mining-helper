import { Component } from "./Component"

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

    waitFor(promise: Promise<any> | void) {
        if (promise) {
            this.Loading = true;
            this.Node.classList.add("loading")
            promise.then(() => {
                this.Loading = false;
                this.Node.classList.remove("loading")
            }).catch(error => {
                // TODO should put a little notice on the button
                // Will need some sort of `allowRetry` property since an initial load failure can't retry
                console.error({ message: "error in promise", error })
            })
        }
    }

    constructor(props: {
        onClick: () => Promise<void> | void,
        // Will show as loading initially until loading promise finishes
        loading?: Promise<any>
    }) {
        super()

        this.Node = <button />

        this.Node.addEventListener("click", () => {
            if (this.Loading) return
            this.waitFor(props.onClick())
        })
        this.waitFor(props.loading)
    }
}
