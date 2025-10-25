import { Modal } from "./Modal"

interface Props {
    onClose: (result?: HTMLInputElement) => void
}

// TODO this thing sucks, should focus field, set styles, set default value
// enter to save, save should close modal
// make sure close calls onClose from parent or something
// Also should have a hotkey for setting offset by clicking (ctrl clicking, that would be so much better than this trash oops for got)
export default (props: Props) => {
    const input = <input placeholder="Input"></input> as HTMLInputElement
    const modal = new Modal({
        body: input,
        header: "Request",
        footer: <button onclick={() => {
            modal._closeNoOnClose()
            props.onClose(input)
        }}>Save</button>,
        onClose: props.onClose
    })
    return modal
}