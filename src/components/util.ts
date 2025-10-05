import "../utils/createElement"

type Child = string | Node
type Children = Child | Child[]

export function seed(id: string, ...children: (Children | ((target: HTMLElement) => Children))[]) {
    const target = document.getElementById(id)
    if (!target) throw new Error(`ID ${id} not found`)
    for (const child of children) {
        let childrenObj;
        if (typeof child === "function") {
            childrenObj = child(target)
        } else {
            childrenObj = child
        }
        if (Array.isArray(childrenObj))
            target.append(...childrenObj)
        else
            target.append(childrenObj)
    }
}

export function seedPage(id: string, children: Child[]) {
    const body = document.body
    body.id = id
    body.replaceChildren(...children)
}