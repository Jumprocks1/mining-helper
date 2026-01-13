import { Component } from "./Component";
import { appendChild, Children } from "./createElement";

export interface LayoutProps {
    page: Page
}

// Page seeding can be done in the constructor like a normal component
// Output should be assigned to Component.Node
export abstract class Page extends Component {
    // not called when user closes the browser tab
    // only called when navigating from one page to another via a router
    // needed for things like closing a websocket, since otherwise a new websocket connection would be attempted on each route
    // ie. websocket page => normal page => websocket page would have 2 active connections
    Dispose() {

    }

    // to use a class as a layout, just do ((props) => new Layout(props))
    Layout: ((layoutProps: LayoutProps) => Children) | undefined
    abstract Id: string // used for limiting styles to 1 page
    Title: string | undefined

    // TODO add routing info once ready
    // thinking we would support a simple string or (route: string) => boolean
}


// TODO move to router
export function loadPage(pageClass: new () => Page) {
    const body = document.body
    const instance = new pageClass()
    document.title = instance.Title ?? "Mining Helper"
    body.id = instance.Id
    body.replaceChildren()
    const layout = instance.Layout // TODO allow a default layout here
    if (layout)
        appendChild(body, layout({ page: instance }))
    else
        appendChild(body, instance.Node)
}