// Ideally we can remove this once the feature is better supported
interface Sanitizer {
    new(): Sanitizer
    allowElement: (element: string) => void
    removeElement: (element: string) => void
    allowAttribute: (attribute: string) => void
    removeAttribute: (attribute: string) => void
    replaceElementWithChildren: (element: string) => void
}

interface Element {
    setHTML(html: string, options?: { sanitizer?: Sanitizer }): void
}

interface Window {
    Sanitizer: Sanitizer
}

declare var Sanitizer: Sanitizer
