import { seed } from "./util"

export default () => {
    seed("mh-header",
        <a className="button" id="title" href="/popup.html">Mining Helper</a>,
        <a className="button mpv" href="/mpv.html">mpv</a>)
}