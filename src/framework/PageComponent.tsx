import { Component } from "./Component";
import { Children } from "./createElement";

export interface LayoutProps {
    page: PageComponent
    children: Children // this isn't always page.Node since it could wrapped in a Loader
}

export function EmptyLayout(props: LayoutProps) { return props.children }

// to use a class as a layout, just do ((props) => new Layout(props))
export type LayoutType = ((layoutProps: LayoutProps) => Children) | undefined

// Page seeding can be done in the constructor like a normal component
// Output should be assigned to Component.Node
export abstract class PageComponent extends Component {
    // not called when user closes the browser tab
    // only called when navigating from one page to another via a router
    // needed for things like closing a websocket, since otherwise a new websocket connection would be attempted on each route
    // ie. websocket page => normal page => websocket page would have 2 active connections
    Dispose() {

    }
    Layout: LayoutType
    abstract Id: string // used for limiting styles to 1 page
    Title: string | undefined

    Load?: () => Promise<void> // could consider returning something from this?

    // TODO would be nice if we had a way for handling global key events here
    // main issue is it's easy to forget to unbind when the page changes, which leaks memory
}
