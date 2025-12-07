import AddIcons, { MaterialIcons } from "../../utils/AddIcons"

AddIcons()

interface Props {
    icon: (typeof MaterialIcons)[number]

    title?: string

    // TODO we could make these like a "standard props" that we can apply generally to any component/node
    onClick?: (ev: PointerEvent) => void
    className?: string // extras
}

export default ({ icon, onClick, className, title }: Props) => {
    const res = <button className="icon-button material-symbols-outlined">{icon}</button>
    if (onClick)
        res.addEventListener("click", ev => {
            onClick(ev)
            // don't hold focus after click, mainly annoying when pressing spacebar (global pause/unpause)
            res.blur()
        })

    if (className) res.classList.add(className)
    else res.classList.add(icon + "-button")

    if (title) res.title = title

    return res
}