import { Children, replaceWith } from "../utils/createElement"

export type DOMable = Node | string | Node[] | string[]
export type Loadable = Promise<DOMable | Children> | (() => Promise<DOMable> | HTMLElement) | HTMLElement

export default ({ load }: { load: Loadable }) => {
    const node = <div className="loader" />
    if (typeof load === "function") load = load()
    if (!("then" in load)) return load
    // TODO should catch exception here
    load.then(e => replaceWith(node, e))
    return node
}