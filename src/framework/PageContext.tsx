

interface PageContext {
    name: string
    data?: any
    getMinimizeTarget?: () => DOMRect | undefined
}

let globalContext: PageContext | undefined

export function RegisterPageContext(context: PageContext) {
    globalContext = context
    document.title = context.name
}

export function GetCurrentPageContext() {
    return globalContext
}