import HotReload from "./HotReload";

HotReload() // Idk where else to put this oh well

type NormalChild = string | Node
type SingleChild = NormalChild | { Node: NormalChild } | boolean | undefined
export type Children = SingleChild | Children[] | (() => Children)

type FC = (props: Record<string, any>) => JSX.Element

export function appendChild(el: ParentNode, child: Children) {
    if (Array.isArray(child)) {
        for (let i = 0; i < child.length; i++) appendChild(el, child[i])
    } else if (typeof child === "object") {
        if ("Node" in child)
            el.append(child.Node)
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
                } else {
                    const v = properties[key];
                    if (v !== undefined)
                        // @ts-ignore
                        el[key] = v!;
                }
            }
        }
    } else {
        if (element === createFragment) {
            el = createFragment();
        } else if (element.prototype && "constructor" in element.prototype) {
            // @ts-expect-error
            el = new element(properties ?? {}).Node;
        } else {
            el = element(properties ?? {});
        }
    }
    appendChild(el, children)
    return el;
}

export function createFragment(...children: any[]): HTMLElement {
    throw new Error("Not supported")
}

window.createElement = createElement;
window.createFragment = createFragment;