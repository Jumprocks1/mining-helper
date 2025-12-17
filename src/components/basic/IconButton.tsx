import { applyBaseComponentProps, BaseComponentProps } from "../../framework/util"
import AddIcons, { MaterialIcons } from "../../utils/AddIcons"

AddIcons()

interface Props extends BaseComponentProps {
    icon: (typeof MaterialIcons)[number]

    title?: string

    // TODO we could make these like a "standard props" that we can apply generally to any component/node
    onClick?: (ev: PointerEvent) => void
    className?: string // extras
    tooltip?: string
}

export default ({ icon, onClick, ...other }: Props) => {
    const res = <button className="icon-button material-symbols-outlined">{icon}</button>
    if (onClick)
        res.addEventListener("click", ev => {
            onClick(ev)
            // don't hold focus after click, mainly annoying when pressing spacebar (global pause/unpause)
            res.blur()
        })

    other.className ??= icon + "-button"
    applyBaseComponentProps(res, other)

    return res
}