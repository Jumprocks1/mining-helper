import IconButton from "./IconButton"

export default (props: { onClick: (down: boolean) => void }) => {
    return <div className="up-down-buttons">
        <IconButton icon="stat_1" onClick={() => props.onClick(false)} />
        <IconButton icon="stat_minus_1" onClick={() => props.onClick(true)} />
    </div>
}