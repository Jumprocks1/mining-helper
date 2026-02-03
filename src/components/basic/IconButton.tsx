import { applyBaseComponentProps, BaseComponentProps } from "../../framework/util"
import AddIcons, { MaterialIcons } from "../../utils/AddIcons"
import LoadingButton, { LoadingButtonProps } from "../LoadingButton"

AddIcons()

interface Props extends LoadingButtonProps {
    icon: (typeof MaterialIcons)[number]
}


interface IconProps<K extends keyof HTMLElementTagNameMap | undefined = undefined> extends BaseComponentProps {
    icon: (typeof MaterialIcons)[number]
    component?: K
    componentProps?: K extends keyof HTMLElementTagNameMap ? Partial<HTMLElementTagNameMap[K]> : undefined
}
export const Icon = <K extends keyof HTMLElementTagNameMap | undefined>(props: IconProps<K>) => {
    const res = createElement(props.component ?? "span", props.componentProps)
    res.textContent = props.icon
    res.classList.add("material-symbols-outlined")
    res.classList.add("icon")
    applyBaseComponentProps(res, props)
    return res
}

export default (props: Props) => IconButtonClass(props).Node

export const IconButtonClass = (props: Props) => {
    const res = new LoadingButton({
        ...props, onClick: ev => {
            // don't hold focus after click, mainly annoying when pressing spacebar (global pause/unpause)
            res.Node.blur()
            return props.onClick?.(ev)
        }
    })
    res.Node.classList.add("icon-button")
    res.Node.classList.add("material-symbols-outlined")
    res.Node.classList.add(props.icon + "-button")
    res.Node.append(props.icon)
    return res
}