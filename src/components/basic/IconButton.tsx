import { applyBaseComponentProps, BaseComponentProps } from "../../framework/util"
import AddIcons, { MaterialIcons } from "../../utils/AddIcons"
import LoadingButton, { LoadingButtonProps } from "../LoadingButton"

AddIcons()

interface Props extends LoadingButtonProps {
    icon: (typeof MaterialIcons)[number]
}

export default (props: Props) => {
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
    return res.Node
}