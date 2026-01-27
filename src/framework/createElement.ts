import HotReload from "./HotReload";

HotReload() // Idk where else to put this oh well

type NormalChild = string | Node
type SingleChild = NormalChild | { Node: Children } | false | undefined
export type Children = SingleChild | Children[] | (() => Children)

type FC = (props: Record<string, any>) => JSX.Element

export function replaceWith(el: ChildNode, child: Children) {
    const fragment = createFragment()
    appendChild(fragment, child)
    el.replaceWith(fragment)
}

export function replaceChildren(el: ParentNode, child: Children) {
    el.replaceChildren()
    appendChild(el, child)
}

export function appendChild(el: ParentNode, child: Children) {
    if (Array.isArray(child)) {
        for (let i = 0; i < child.length; i++) appendChild(el, child[i])
    } else if (typeof child === "object" && child !== null) {
        if ("Node" in child)
            appendChild(el, child.Node)
        else
            el.append(child);
    } else if (typeof child === "string") {
        el.append(child);
    } else if (typeof child === "function") {
        appendChild(el, child())
    } else if (typeof child === "number") {
        el.append(child)
    } else {
        // throw new Error(`Unrecognized child: ${child}`)
    }
}

export function createElement(element: string | FC,
    properties?: any, ...children: any[]) {
    if (properties && properties.children && (!children || children.length === 0)) {
        children = properties.children
        delete properties.children
    }
    let el: HTMLElement;
    if (typeof element === "string") {
        el = document.createElement(element);
        if (properties) {
            for (const key in properties) {
                if (key === "style") {
                    for (const key2 in properties[key])
                        // @ts-ignore
                        el[key][key2] = properties[key][key2];
                    // I don't really use/like this
                    // } else if (key.startsWith("data-")) {
                    //     el.dataset[key.substring(5)] = properties[key]
                } else {
                    const v = properties[key];
                    if (v !== undefined)
                        // @ts-ignore
                        el[key] = v!;
                }
            }
        }
    } else {
        if (element.prototype && "constructor" in element.prototype) {
            // note, function will trigger this, ie. `function A() {}`, lambda will not `const A = () => {}`
            // looks like this is fixable with checking getOwnPropertyDescriptor prototype.writable, but it's fine for now
            // @ts-expect-error
            el = new element(properties ?? {}).Node;
        } else {
            el = element(properties ?? {});
        }
    }
    appendChild(el, children)
    return el;
}

// can't be a regular function since those have prototypes + constructors
export const createFragment = () => {
    return document.createDocumentFragment()
}

window.createElement = createElement;
window.createFragment = createFragment;