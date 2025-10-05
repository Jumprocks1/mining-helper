import { seed } from "./util"

export default () => {
    const header = <div id="mh-header">
        <a className="button home" id="title" href="/popup.html">Mining Helper</a>
        <a className="button mpv" href="/mpv.html">mpv</a>
        <a className="button anki" href="/anki.html">Anki</a>
    </div>
    return header
}