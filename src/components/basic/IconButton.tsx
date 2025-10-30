import AddIcons, { MaterialIcons } from "../../utils/AddIcons"

AddIcons()

interface Props {
    icon: (typeof MaterialIcons)[number]

    // TODO we could make these like a "standard props" that we can apply generally to any component/node
    onClick?: () => void
    className?: string // extras
}

export default ({ icon, onClick, className }: Props) => {
    const res = <span className="icon-button material-symbols-outlined">{icon}</span>
    if (onClick) res.addEventListener("click", onClick)

    if (className) res.classList.add(className)
    else res.classList.add(icon + "-button")

    return res
}