import { LoadableChildren } from "../Loader"

interface Props {
    checked?: boolean
    onChange: (e: boolean) => void
    label?: string
    id?: string
    tooltip?: LoadableChildren
}

export default (props: Props) => {
    const res = <label htmlFor={props.id} className="checkbox-field" tooltip={props.tooltip}>
        <input id={props.id} type="checkbox" checked={props.checked} onchange={ev => {
            const target = ev.target as HTMLInputElement
            props.onChange(target.checked)
        }} />
        {props.label}
    </label>
    return res
}