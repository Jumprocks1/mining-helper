import { type Children, replaceWith } from "../framework/createElement"
import { userErrorMessage } from "../utils/UserError"

export type Loadable = Promise<Children> | (() => Promise<Children> | HTMLElement) | HTMLElement

export default ({ load }: { load: Loadable }) => {
    const node = <div className="loader" />
    if (typeof load === "function") {
        try {
            load = load()
        } catch (e: unknown) {
            console.error(e)
            node.dataset.error = userErrorMessage(e)
            return node
        }
    }
    if (!("then" in load)) return load
    load.then(e => replaceWith(node, e)).catch(e => {
        console.error(e)
        node.dataset.error = userErrorMessage(e)
    })
    return node
}