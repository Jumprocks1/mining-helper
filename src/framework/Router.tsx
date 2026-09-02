import Loader from "../components/Loader"
import "./createElement" // sets window.createElement
import { appendChild, type Children } from "./createElement"
import { LayoutType, type PageComponent } from "./PageComponent"

type PageClass = new () => PageComponent

export interface PageDefinition {
    path: string
    pathMatch?: (path: string) => boolean
    component: PageClass
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
    fallbackPage: PageClass
    fallbackTitle: string
    fallbackLayout?: LayoutType
    routePreference: "html" | "no-ext" | "p"
    basePath?: string
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

    const base = cleanedBase()
    if (base && path.startsWith(base)) {
        path = path.substring(base.length)
    }

    if (!path.startsWith("/"))
        path = "/" + path;


    return path
}


// @ts-expect-error - this gets set right away, so might as well be not-undefined
let globalRouterProps: Props = undefined
// @ts-expect-error - this gets set right away, so might as well be not-undefined
let currentPage: PageComponent = undefined

function cleanedBase() {
    let base = globalRouterProps.basePath
    if (!base) return
    if (!base.startsWith("/")) base = "/" + base
    if (!base.endsWith("/")) base = base + "/"
    return base
}

export function navigateTo(page: PageDefinition | string) {
    let path = typeof page === "string" ? page : page.path
    if (globalRouterProps.routePreference === "html") {
        if (!path.endsWith(".html")) path = path + ".html"
    }
    if (globalRouterProps.routePreference === "p") {
        const params = new URLSearchParams(window.location.search);
        if (path.endsWith(".html")) path = path.substring(0, path.length - 5)
        if (path.startsWith("/")) path = path.substring(1)
        params.set("p", path)
        window.location.search = params.toString();
    } else {
        history.pushState(undefined, "", path)
    }
    for (const e of onRouteChangeListeners) e()
}


export function CurrentPage() {
    return currentPage
}

const onRouteChangeListeners: (() => void)[] = []

export function addRouteChangeListener(listener: () => void) {
    onRouteChangeListeners.push(listener)
}

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
                    const href = anchor.getAttribute("href")
                    if (anchor.origin === location.origin && href) {
                        ev.preventDefault()
                        navigateTo(href)
                    }
                }
            })
        }
        props.onInit?.()

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
            const pageClass = getPageFromRoute(route)
            if (currentPage) {
                // potentially need something like page.RouteUpdated() here
                if (Object.getPrototypeOf(currentPage) === pageClass.prototype) return
                currentPage.Dispose()
            }

            const instance = new pageClass()
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
        addRouteChangeListener(recalculateRoute)
        window.addEventListener("popstate", () => {
            for (const e of onRouteChangeListeners) e()
        })
    }
    if (document.readyState !== "loading") init()
    else document.addEventListener("DOMContentLoaded", init)
}
