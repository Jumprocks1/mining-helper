import "../framework/createElement"
import { appendChild, Children } from "../framework/createElement"

// TODO remove in favor of `loadPage`
export function seedPage(id: string, children: Children) {
    const body = document.body
    body.id = id
    body.replaceChildren()
    appendChild(body, children)
}

export interface BaseComponentProps {
    className?: string
    id?: string
    tooltip?: string
    title?: string
}

export function applyBaseComponentProps(node: HTMLElement, props: BaseComponentProps) {
    if (props.className) node.classList.add(props.className)
    if (props.tooltip) node.dataset.tooltip = props.tooltip
    if (props.title) node.title = props.title
    if (props.id) node.id = props.id

    return node
}