import { type Children, replaceWith } from "../framework/createElement"
import { userErrorMessage } from "../utils/UserError"


export type LoadableChildren = Promise<Children> | (() => Promise<Children> | Children) | Children

// slightly nicer than <Loader /> since it feels more like a regular function
export const Load = (load: LoadableChildren) => {
    let children: Promise<Children> | Children
    if (typeof load === "function") {
        try {
            children = load()
        } catch (e: unknown) {
            console.error(e)
            const node = <div className="loader" />
            node.dataset.error = userErrorMessage(e)
            return node
        }
    } else {
        children = load
    }
    if (!(children instanceof Promise)) return children

    const node = <div className="loader" />
    children.then(e => replaceWith(node, e)).catch(e => {
        console.error(e)
        node.dataset.error = userErrorMessage(e)
    })
    return node
}

// cast isn't perfect but it's close enough, needed for JSX to work
// if JSX didn't have awful typing it'd be fine
export default ({ load }: { load: LoadableChildren }) => Load(load) as HTMLElement