import { type Children, replaceWith } from "../framework/createElement"
import { userErrorMessage } from "../utils/UserError"


export type LoadableChildren<T = undefined> = Promise<Children> | ((props: T) => Promise<Children> | Children) | Children

type LoadOverload = {
    (load: LoadableChildren<undefined>, props?: undefined, loaderProps?: LoaderProps): Children;
    <T>(load: LoadableChildren<T>, props: T, loaderProps?: LoaderProps): Children;
}

interface LoaderProps {
    showFullError?: boolean
}

// slightly nicer than <Loader /> since it feels more like a regular function
export const Load: LoadOverload = (load: LoadableChildren<any>, props?: any, loaderProps?: LoaderProps) => {
    let children: Promise<Children> | Children
    if (typeof load === "function") {
        try {
            children = load(props)
        } catch (e: unknown) {
            console.error(e)
            const node = <div className="loader" />
            node.classList.add("errored")
            node.tooltipError = userErrorMessage(e)
            return node
        }
    } else {
        children = load
    }
    if (!(children instanceof Promise)) return children

    const node = <div className="loader" />
    children.then(e => replaceWith(node, e)).catch(e => {
        console.error(e)
        if (loaderProps?.showFullError) {
            node.replaceWith(<div className="error-text-display">{userErrorMessage(e)}</div>)
        } else {
            node.classList.add("errored")
            node.tooltipError = userErrorMessage(e)
        }
    })
    return node
}

// cast isn't perfect but it's close enough, needed for JSX to work
// if JSX didn't have awful typing it'd be fine
export default ({ load, showFullError }: LoaderProps & { load: LoadableChildren }) => Load(load, undefined, { showFullError }) as HTMLElement