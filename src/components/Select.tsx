import { Children } from "../framework/createElement"
import { ForceShowTooltip } from "../framework/Tooltips"
import { userErrorMessage } from "../utils/UserError"

export type SelectOption = string | [value: string, display: Children]

interface Props {
    loadOptions?: () => Promise<readonly SelectOption[]>
    options?: readonly SelectOption[]
    defaultValue?: string
    onChange?: (value: string) => void
    includeEmpty?: true
    unsetLabel?: Children
}

export default ({ defaultValue = "", unsetLabel = "Unset", onChange, options, loadOptions, includeEmpty }: Props) => {
    let selected = defaultValue
    const select = <select onchange={ev => {
        selected = (ev.currentTarget as any).value
        onChange?.(selected)
    }} />
    let loaded = false

    function addOption(option: SelectOption) {
        const value = typeof option === "string" ? option : option[0]
        const label = typeof option === "string" ? option : option[1]
        select.append(<option hidden={!loaded && !value && !includeEmpty} value={value}
            selected={value === selected}
            className={value ? undefined : "unset"}>
            {label || unsetLabel}
        </option>)
    }

    const res: {
        Node: HTMLElement
        Reset?: () => void
    } = { Node: select, }

    if (options) {
        options.forEach(addOption)
        if (!options.some(e => typeof e === "string" ? e === selected : e[0] === selected))
            addOption(selected)
    } else if (loadOptions) {
        addOption(selected)
        const message = <option disabled></option> as HTMLOptionElement
        select.append(message)
        async function load() {
            if (loaded) return
            loaded = true
            try {
                message.innerText = "Loading..."
                message.hidden = false
                select.tooltipError = undefined
                const options = await loadOptions!()
                if (includeEmpty && selected !== "" && !options.includes("")) addOption("")
                message.hidden = true
                for (const option of options) {
                    if (typeof option === "string" ? option === selected : option[0] === selected) continue
                    addOption(option)
                }
            } catch (e) {
                console.error(e)
                loaded = false
                message.innerText = "Error occured"
                select.blur()
                select.tooltipError = userErrorMessage(e)
                ForceShowTooltip(select)
            }
        }
        select.addEventListener("pointerdown", load)
        select.addEventListener("focus", load)
        res.Reset = () => {
            loaded = false
            for (let i = select.children.length - 1; i >= 0; i--) {
                const option = select.children.item(i) as HTMLOptionElement
                if (option.value !== selected && option !== message) {
                    option.remove()
                }
            }
        }
    } else {
        addOption(selected)
    }
    return res
}