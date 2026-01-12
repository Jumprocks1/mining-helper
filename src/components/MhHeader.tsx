import { debounce } from "../utils/util"
import { getSetting, onSettingChange } from "../views/SettingsModal"


let customSheet: CSSStyleSheet | undefined
function updateCustomCss(css: string) {
    if (css) {
        if (!customSheet) {
            customSheet = new CSSStyleSheet()
            document.adoptedStyleSheets.push(customSheet)
        }
        customSheet.replaceSync(css)
    } else {
        if (customSheet) {
            document.adoptedStyleSheets.splice(document.adoptedStyleSheets.indexOf(customSheet), 1)
            customSheet = undefined
        } else {
            // no action needed
        }
    }
}

// could move this elsewhere, but seems fine for now
async function onPageLoad() {
    onSettingChange("customCss", e => {
        debounce("customCssChanged", 500, () => updateCustomCss(e))
    })
    updateCustomCss(await getSetting("customCss"))
}

export default () => {
    // we don't await this currently, maybe we should
    // shouldn't matter for localStorage since there's no actual await
    onPageLoad()
    return <div id="mh-header">
        <a className="button home" id="title" href="/home.html">Mining Helper</a>
        <a className="button subs" href="/subtitles.html">Subs</a>
        <a className="button anki" href="/anki.html">Anki</a>
        <a className="button ss" href="/ss.html">Sentences</a>
    </div>
}