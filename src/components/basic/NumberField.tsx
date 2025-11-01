import IconButton from "./IconButton"

interface Props {
    defaultValue?: number
    onChange: (e: number) => void
}

export default (props: Props) => {
    let value = props.defaultValue ?? 0
    function setValue(v: number) {
        value = v
        display.innerText = v.toString()
        props.onChange(v)
    }
    function handleEv(ev: MouseEvent, negative: boolean) {
        let mult = -10
        if (ev.ctrlKey) mult *= 10
        if (ev.shiftKey) mult /= 10
        setValue(value + (negative ? -1 : 1) * mult)
        ev.preventDefault()
    }
    const display = <div className="number-display">{value}</div>
    const res = <div className="number-field">
        <div className="change-buttons">
            <IconButton icon="stat_1" onClick={ev => { handleEv(ev, false) }} />
            <IconButton icon="stat_minus_1" onClick={ev => { handleEv(ev, true) }} />
        </div>
        {display}
    </div>
    res.addEventListener("wheel", ev => {
        const dir = ev.deltaY > 0 ? 1 : ev.deltaY < 0 ? -1 : 0
        if (dir !== 0) {
            handleEv(ev, dir < 0)
        }
    })
    return res
}