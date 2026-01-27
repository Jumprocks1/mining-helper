import { LoadableChildren } from "../components/Loader"

export interface BaseComponentProps {
    className?: string
    id?: string
    tooltip?: LoadableChildren
    title?: string
}

export function applyBaseComponentProps(node: HTMLElement, props: BaseComponentProps) {
    if (props.className) node.classList.add(props.className)
    if (props.tooltip) node.tooltip = props.tooltip
    if (props.title) node.title = props.title
    if (props.id) node.id = props.id

    return node
}