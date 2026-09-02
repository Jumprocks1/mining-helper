import { BindSpaRouter } from "../framework/Router";
import HomePage from "./home/home";
import MainLayout from "./MainLayout";
import pages from "./pages";
import { debounce } from "../utils/util"
import { getSetting, onSettingChange } from "../views/SettingsModal"
import { RegisterTooltipEvents } from "../framework/Tooltips";

// we could target body directly, but that has issues since we clear the body on each page load
// if we store things like the modal portal in the body, they would get removed on navigation
const pageBody = <div className="page-container" />

declare var GITHUB_PAGES: boolean | undefined

BindSpaRouter({
    target: () => pageBody,
    pages,
    routePreference: "html",
    fallbackPage: HomePage,
    basePath: GITHUB_PAGES ? "mining-helper" : undefined,
    fallbackTitle: "Mining Helper",
    fallbackLayout: MainLayout,
    onInit: onPageLoad,
    spaLinks: true
})
RegisterTooltipEvents()


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
    document.body.append(pageBody)
    onSettingChange("customCss", e => {
        debounce("customCssChanged", 500, () => updateCustomCss(e))
    })
    updateCustomCss(await getSetting("customCss"))
}