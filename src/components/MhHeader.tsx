import { seed } from "./util"

const children = () => [
    <a className="button" id="title" href="/popup.html">Mining Helper</a>,
    <a className="button mpv" href="/mpv.html">mpv</a>,
    <a className="button anki" href="/anki.html">Anki</a>]

export function seedHeader() { // TODO get rid of this
    seed("mh-header", children)

}

export default () => <div id="mh-header">
    {...children()}
</div>