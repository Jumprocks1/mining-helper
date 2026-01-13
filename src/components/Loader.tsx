import { type Children, replaceWith } from "../framework/createElement"
import { userErrorMessage } from "../utils/UserError"

export type DOMable = Node | string | Node[] | string[] // can probably get rid of this for `Children`
export type Loadable = Promise<Children> | (() => Promise<Children> | HTMLElement) | HTMLElement

export default ({ load }: { load: Loadable }) => {
    const node = <div className="loader" />
    if (typeof load === "function") {
        try {
            load = load()
        } catch (e: unknown) {
            node.dataset.error = userErrorMessage(e)
            return node
        }
    }
    if (!("then" in load)) return load
    load.then(e => replaceWith(node, e)).catch(e => {
        node.dataset.error = userErrorMessage(e)
    })
    return node
}