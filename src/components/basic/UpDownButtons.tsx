import IconButton from "./IconButton"

export default (props: { onClick: (ev: MouseEvent, down: boolean) => void }) => {
    return <div className="up-down-buttons">
        <IconButton icon="stat_1" onClick={ev => props.onClick(ev, false)} />
        <IconButton icon="stat_minus_1" onClick={ev => props.onClick(ev, true)} />
    </div>
}