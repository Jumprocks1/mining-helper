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

    constructor(props: {
        onClick: () => Promise<void> | void
    }) {
        super()

        this.Node = <button />

        this.Node.addEventListener("click", () => {
            if (this.Loading) return
            const res = props.onClick()
            if (res) {
                this.Loading = true;
                this.Node.classList.add("loading")
                res.then(() => {
                    this.Loading = false;
                    this.Node.classList.remove("loading")
                })
            }
        })
    }
}
