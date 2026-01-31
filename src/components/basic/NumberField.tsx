import { onDeath } from "../../framework/Observer"
import { applyBaseComponentProps, BaseComponentProps } from "../../framework/util"
import Effects from "../../utils/Effects"
import { AllSettings, getDefaultSetting, setSetting, type SettingsKey } from "../../views/SettingsModal"
import UpDownButtons from "./UpDownButtons"

type NumericSettingsKey = { [key in SettingsKey]: AllSettings[key] extends number ? key : never }[SettingsKey]

interface Props extends BaseComponentProps {
    // TODO a lot of times defaultValue, initialValue, and onChange all target a settings key
    defaultValue?: number
    initialValue?: number
    onChange: (e: number) => void
    label?: string
    showPlus?: true
    min?: number
    max?: number
    baseChange?: number
    units?: string
    storeDefault?: ((e: number) => void) | NumericSettingsKey
}

export default (props: Props) => {
    if (props.min !== undefined && props.max !== undefined && props.min > props.max)
        throw new Error("Min greater than max")
    const storeDefault = props.storeDefault
    let defaultValue = props.defaultValue ?? (typeof storeDefault === "string" ? getDefaultSetting(storeDefault as NumericSettingsKey) : 0)

    let pendingValue = "" // when typing
    let value = props.initialValue ?? defaultValue
    function updateInnerText() {
        pendingValue = ""
        let text = props.showPlus && value >= 0 ? "+" + value : value.toString()
        if (props.units) text += props.units
        display.innerText = text
    }
    function setValue(v: number) {
        value = v
        if (props.max !== undefined && value > props.max)
            value = props.max
        if (props.min !== undefined && value < props.min)
            value = props.min
        updateInnerText()
        props.onChange(v)
    }
    function handleEv(ev: MouseEvent, negative: boolean) {
        let mult = props.baseChange ?? 10
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
            handleEv(ev, dir > 0)
        }
    }, { passive: false }) // we call preventDefault, so can't let the browser run it's own scrolling in parallel

    function commitPending() {
        const v = parseInt(pendingValue)
        if (Number.isFinite(v)) setValue(v)
        else updateInnerText()
    }

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === "r") {
            setValue(defaultValue)
        } else if (e.key === "d") {
            commitPending()
            if (defaultValue !== value) {
                defaultValue = value
                if (props.storeDefault) {
                    if (typeof props.storeDefault === "string")
                        setSetting(props.storeDefault, defaultValue)
                    else
                        props.storeDefault?.(defaultValue)
                }
                Effects.flash(res)
            }
            e.stopPropagation()
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
    const leave = () => {
        document.removeEventListener("keydown", onKeyDown, true)
        commitPending()
    }
    let deathRegistered = false
    res.addEventListener("mouseenter", () => {
        document.addEventListener("keydown", onKeyDown, true)
        if (deathRegistered) return
        onDeath(res, leave)
        deathRegistered = true
    })
    res.addEventListener("mouseleave", leave)

    applyBaseComponentProps(res, props)
    res.tooltip = () => {
        return <>
            Scroll or type to adjust.{"\n\n"}
            {/* If we aren't storing default, don't bother explaining */}
            {props.storeDefault && <>Press <kbd>D</kbd> to set the default{"\n"}</>}
            Press <kbd>R</kbd> to reset to default{"\n"}
            Hold <kbd>Ctrl</kbd> while scrolling for larger adjustments{"\n"}
            Hold <kbd>Shift</kbd> for smaller adjustments
        </>
    }
    return res
}