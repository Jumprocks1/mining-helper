export type DOMable = Node | string | Node[] | string[]
export type Loadable = Promise<DOMable> | (() => Promise<DOMable> | HTMLElement) | HTMLElement

export default ({ load }: { load: Loadable }) => {
    const node = <div className="loader" />
    if (typeof load === "function") load = load()
    if (!("then" in load)) return load
    // TODO should catch exception here
    load.then(e => {
        if (Array.isArray(e))
            node.replaceWith(...e)
        else
            node.replaceWith(e)
    })
    return node
}