import { seed } from "./util"

export default () => {
    const header = <div id="mh-header">
        <a className="button home" id="title" href="/popup.html">Mining Helper</a>
        <a className="button subs" href="/subs.html">Subs</a>
        <a className="button anki" href="/anki.html">Anki</a>
        <a className="button ss" href="/ss.html">SS</a>
    </div>
    return header
}