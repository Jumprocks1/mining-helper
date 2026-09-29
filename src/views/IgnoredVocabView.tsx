import IconButton from "../components/basic/IconButton"
import Loader from "../components/Loader"
import { OpenModal } from "../components/Modal"
import { IgnoreWord, loadIgnoreList, UnIgnoreWord } from "../jpdb/IgnoreList"

declare global {
    interface Element {
        data?: any
    }
}

export default () => {
    const load = () => <Loader load={async () => {
        const ignored = (await loadIgnoreList()).toReversed()
        const body = <tbody>
            {ignored.map(e => {
                const makeDeleteButton = (ignored: boolean) => <IconButton icon={ignored ? "restore_from_trash" : "delete"}
                    title={ignored ? "Restore" : "Ignore"}
                    onClick={async () => {
                        if (ignored) {
                            ignored = false
                            await UnIgnoreWord(e.word)
                        } else {
                            ignored = true
                            await IgnoreWord(e.word)
                        }
                        deleteButton.replaceWith(deleteButton = makeDeleteButton(ignored))
                    }} />
                let deleteButton = makeDeleteButton(true)

                const o = <tr>
                    <td>{e.word}</td>
                    <td>{e.expire ? new Date(e.expire).toLocaleDateString() : "Never"}</td>
                    <td>{deleteButton}</td>
                </tr>
                o.data = e
                return o
            })}
        </tbody>
        return <>
            <input oninput={ev => {
                const rows = body.querySelectorAll("tbody > tr")
                for (const row of rows) {
                    const word = row.data?.word
                    if (word) {
                        row.classList.toggle("hide", !(word as string).includes((ev.target as HTMLInputElement).value))
                    }
                }
            }} placeholder="Search..." />
            <table>
                <thead>
                    <tr>
                        <th>Word</th>
                        <th>Expires</th>
                        <th />
                    </tr>
                </thead>
                {body}
            </table>
        </>
    }} />
    const body = load()

    const modal = OpenModal({
        header: "Ignored Vocab",
        body,
        id: "ignored-vocab-modal"
    })
    return modal
}