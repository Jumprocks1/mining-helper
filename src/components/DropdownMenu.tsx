import { Children } from "../framework/createElement"
import IconButton from "./basic/IconButton"
import { JsPopover } from "./basic/JsPopover"

type Option = { node: Children }
interface Props<T extends Option> {
    button?: HTMLButtonElement
    options: T[] | (() => Promise<T[]>)
    onSelect: (option: T) => void
}

export default <T extends Option>({ button, options, onSelect }: Props<T>) => {
    button ??= <IconButton icon="menu" /> as HTMLButtonElement
    const menuPopover = new JsPopover({
        className: "menu",
        hydrate: async () => {
            let loadedOptions = options
            if (typeof loadedOptions === "function")
                loadedOptions = await loadedOptions()
            return loadedOptions.map(e => <div className="menu-option"
                onclick={() => {
                    onSelect(e)
                    menuPopover.Close()
                }}>
                {e.node}
            </div>)
        },
        anchor: button
    })
    button.addEventListener("click", () => menuPopover.Toggle())

    return button
}