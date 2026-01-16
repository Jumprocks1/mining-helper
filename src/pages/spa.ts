import { BindSpaRouter } from "../framework/Router";
import HomePage from "./home/home";
import MainLayout from "./MainLayout";
import pages from "./pages";
import { debounce } from "../utils/util"
import { getSetting, onSettingChange } from "../views/SettingsModal"

BindSpaRouter({
    target: () => document.body,
    pages,
    routePreference: "html",
    fallbackPage: HomePage,
    fallbackTitle: "Mining Helper",
    fallbackLayout: MainLayout,
    onInit: onPageLoad,
    spaLinks: true
})


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