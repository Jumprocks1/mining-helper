type FC = (props: Record<string, any>) => JSX.Element

function appendChildren(el: ParentNode, children: any[]) {
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (Array.isArray(child)) {
            appendChildren(el, child)
        } else if (typeof child === "object") {
            el.append(child);
        } else if (typeof child === "string") {
            el.append(child);
        } else if (child !== undefined && child !== false) {
            el.append(child.toString());
        }
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
        } else {
            el = element(properties ?? {});
        }
    }
    appendChildren(el, children)
    return el;
}

export function createFragment(...children: any[]): HTMLElement {
    throw new Error("Not supported")
}

window.createElement = createElement;
window.createFragment = createFragment;