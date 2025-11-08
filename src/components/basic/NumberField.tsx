import IconButton from "./IconButton"
import UpDownButtons from "./UpDownButtons"

interface Props {
    defaultValue?: number
    onChange: (e: number) => void
    label?: string
    showPlus?: true
}

export default (props: Props) => {
    const defaultValue = props.defaultValue ?? 0
    let pendingValue = "" // when typing
    let value = defaultValue
    function updateInnerText() {
        pendingValue = ""
        display.innerText = props.showPlus && value >= 0 ? "+" + value : value.toString()
    }
    function setValue(v: number) {
        value = v
        updateInnerText()
        props.onChange(v)
    }
    function handleEv(ev: MouseEvent, negative: boolean) {
        let mult = -10
        if (ev.ctrlKey) mult *= 10
        if (ev.shiftKey) mult /= 10
        setValue(value + (negative ? -1 : 1) * mult)
        ev.preventDefault()
    }
    const display = <div className="number-display"></div>
    updateInnerText()
    const res = <div className="number-field">
        <UpDownButtons onClick={handleEv} />
        <div className="display">
            {props.label && <label>{props.label}</label>}
            {display}
        </div>
    </div>
    res.addEventListener("wheel", ev => {
        const dir = ev.deltaY > 0 ? 1 : ev.deltaY < 0 ? -1 : 0
        if (dir !== 0) {
            handleEv(ev, dir < 0)
        }
    })

    function commitPending() {
        const v = parseInt(pendingValue)
        if (Number.isFinite(v)) setValue(v)
        else updateInnerText()
    }

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === "r") {
            setValue(defaultValue)
        } else if (e.key === "-" || (e.key >= "0" && e.key <= "9")) {
            pendingValue += e.key
            display.innerText = pendingValue
        } else if (e.key === "Backspace") {
            if (pendingValue.length > 0) pendingValue = pendingValue.substring(0, pendingValue.length - 1)
            display.innerText = pendingValue
        } else if (e.key === "Enter") {
            commitPending()
        }
    }
    res.addEventListener("mouseenter", () => document.addEventListener("keydown", onKeyDown))
    res.addEventListener("mouseleave", () => {
        document.removeEventListener("keydown", onKeyDown)
        commitPending()
    })
    return res
}