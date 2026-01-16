import Loader from "../components/Loader"
import "./createElement" // sets window.createElement
import { appendChild, type Children } from "./createElement"
import { LayoutType, type PageComponent } from "./PageComponent"

export interface PageDefinition {
    path: string
    pathMatch?: (path: string) => boolean
    component: new () => PageComponent
}

export type Pages = {
    [key in string]: PageDefinition
}

interface Props {
    // deferred since body won't even exist usually
    // could be something like () => document.getElementById or just () => document.body
    target: () => HTMLElement
    pages: Pages
    onInit?: () => void
    fallbackPage: new () => PageComponent
    fallbackTitle: string
    fallbackLayout?: LayoutType
    routePreference: "html" | "no-ext"
    spaLinks: boolean
}

function getRouteFromLocation() {
    const location = document.location
    const params = new URLSearchParams(location.search)
    let path = params.get("p")
    if (!path) {
        path = location.pathname
        const dot = path.lastIndexOf(".") // remove .html
        if (dot >= 0) path = path.substring(0, dot)
    }

    if (!path.startsWith("/"))
        path = "/" + path;

    return path
}


// @ts-expect-error - this gets set right away, so might as well be not-undefined
let globalRouterProps: Props = undefined

export function navigateTo(page: PageDefinition | string) {
    let path = typeof page === "string" ? page : page.path
    if (globalRouterProps.routePreference === "html") {
        if (!path.endsWith(".html")) path = path + ".html"
    }
    history.pushState(undefined, "", path)
    for (const e of onRouteChangeListeners) e()
}

const onRouteChangeListeners: (() => void)[] = []

export function BindSpaRouter(props: Props) {
    globalRouterProps = props
    function init() {
        const target = props.target()
        if (props.spaLinks) {
            target.addEventListener("click", ev => {
                if (ev.ctrlKey) return // allow browser to handle ctrl click (new tab)
                // not sure if this is perfect, will monitor
                const target = ev.target as HTMLElement
                if (target && target.tagName === "A") {
                    const anchor = target as HTMLAnchorElement
                    if (anchor.origin === location.origin && anchor.pathname) {
                        ev.preventDefault()
                        navigateTo(anchor.pathname)
                    }
                }
            })
        }
        props.onInit?.()

        let currentPage: PageComponent | undefined

        function getPageFromRoute(route: string) {
            for (const pageKey in props.pages) {
                const pageDef = props.pages[pageKey]
                const path = pageDef.path
                if (path === route || (pageDef.pathMatch && pageDef.pathMatch(route))) {
                    return pageDef.component
                }
            }
            return props.fallbackPage
        }

        function recalculateRoute() {
            const route = getRouteFromLocation()
            const pageComponent = getPageFromRoute(route)
            if (currentPage) {
                // potentially need something like page.RouteUpdated() here
                if (Object.getPrototypeOf(currentPage) === pageComponent.prototype) return
                currentPage.Dispose()
            }

            const instance = new pageComponent()
            currentPage = instance

            document.title = instance.Title ?? props.fallbackTitle
            target.id = instance.Id
            const layout = instance.Layout ?? props.fallbackLayout
            let children: Children

            const load = instance.Load
            if (load) {
                children = <Loader load={async () => {
                    await load()
                    return instance.Node
                }} />
            } else children = instance.Node

            target.replaceChildren()
            if (layout)
                appendChild(target, layout({ page: instance, children }))
            else
                appendChild(target, children)
        }
        recalculateRoute()
        onRouteChangeListeners.push(recalculateRoute)
    }
    if (document.readyState !== "loading") init()
    else document.addEventListener("DOMContentLoaded", init)
}
