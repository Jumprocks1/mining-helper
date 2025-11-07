declare namespace JSX {
    type IntrinsicElements = {
        [K in keyof HTMLElementTagNameMap]: Partial<HTMLElementTagNameMap[K]>
    };

    // sadly this is the only return type
    // there's nothing related to generics or overloads that we can do to have different return types based on inputs
    type Element = HTMLElement // technically this should be `Node`, but HTMLElement is easier to work with
}

type DeepPartial<T> = {
    [P in keyof T]?: Partial<T[P]>;
};


declare function createElement<T extends keyof HTMLElementTagNameMap>(
    element: T, properties?: DeepPartial<HTMLElementTagNameMap[T]>, ...children: any[]): JSX.Element
declare function createElement<T extends (props: Record<string, any>) => JSX.Element>(
    element: T, properties?: Parameters<T>[0], ...children: any[]): JSX.Element
declare function createFragment(): DocumentFragment
