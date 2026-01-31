import { UpdateTooltip } from "../framework/Tooltips"
import { userErrorMessage } from "../utils/UserError"

interface Props {
    loadOptions?: () => Promise<string[]>
    defaultValue?: string
    onChange?: (value: string) => void
    includeEmpty?: true
}

export default ({ defaultValue = "", onChange, loadOptions, includeEmpty }: Props) => {
    let selected = defaultValue
    const select = <select onchange={ev => {
        selected = (ev.currentTarget as any).value
        onChange?.(selected)
    }} />
    let loaded = false

    function addOption(value: string) {
        select.append(<option hidden={!loaded && !value && !includeEmpty} value={value}
            className={value ? undefined : "unset"}>
            {value || "Unset"}
        </option>)
    }

    addOption(selected)

    const res: {
        Node: HTMLElement
        Reset?: () => void
    } = { Node: select, }

    if (loadOptions) {
        const message = <option disabled></option> as HTMLOptionElement
        select.append(message)
        async function load() {
            if (loaded) return
            loaded = true
            try {
                message.innerText = "Loading..."
                message.hidden = false
                const options = await loadOptions!()
                if (includeEmpty && selected !== "" && !options.includes("")) addOption("")
                message.hidden = true
                for (const option of options) {
                    if (option === selected) continue
                    addOption(option)
                }
            } catch (e) {
                console.error(e)
                loaded = false
                message.innerText = "Error occured"
                // sadly this tooltip isn't visible until they close the list
                select.tooltipError = userErrorMessage(e)
                UpdateTooltip(select)
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
    }
    return res
}