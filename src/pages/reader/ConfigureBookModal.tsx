import NumberField from "../../components/basic/NumberField"
import Loader from "../../components/Loader"
import { OpenModal } from "../../components/Modal"
import { CurrentPage } from "../../framework/Router"
import { HookReader } from "../../reader/HookReader"
import { Library, LibraryBook } from "../../reader/Library"
import ReaderPage from "./ReaderPage"

export default (library: Library, book: LibraryBook) => {
    const loadBody = async () => {
        if (book.source === "page-hook") {
            book.config ??= {}
            const config = book.config
            const set = <Key extends keyof typeof config>(key: Key, value: (typeof config)[Key]) => {
                config[key] = value
                library.Save()
                const currentPage = CurrentPage()
                if (currentPage instanceof ReaderPage) {
                    const reader = currentPage.Reader
                    if (reader && reader instanceof HookReader) {
                        reader.sendMessage({ type: "update-config", config: book.config })
                    }
                }
            }
            return <>
                <div className="field">
                    <div className="label">Hook Delay</div>
                    <NumberField units="ms" baseChange={10} min={0}
                        defaultValue={300}
                        initialValue={config.hookDelay}
                        onChange={v => set("hookDelay", v)} />
                </div>
                <div className="field">
                    <label>Main Text Selector</label>
                    <input defaultValue={config.mainTextSelector}
                        onchange={e => set("mainTextSelector", (e.target as HTMLInputElement).value)} />
                </div>
                <div className="field">
                    <label>Name Selector</label>
                    <input defaultValue={config.nameSelector}
                        onchange={e => set("nameSelector", (e.target as HTMLInputElement).value)} />
                </div>
                <div className="field">
                    <label>Option Selector</label>
                    <input defaultValue={config.optionSelector}
                        onchange={e => set("optionSelector", (e.target as HTMLInputElement).value)} />
                </div>
                <div className="field">
                    <label>Advance Click Selector</label>
                    <input defaultValue={config.advanceClickSelector}
                        onchange={e => set("advanceClickSelector", (e.target as HTMLInputElement).value)} />
                </div>
            </>
        }

        throw `Unexpected book type ${book.source}`
    }

    const modal = OpenModal({
        header: `Configuring ${book.name ?? book.key}`,
        id: "configure-book-modal",
        body: <Loader load={loadBody} />
    })
    return modal
}
