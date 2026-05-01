import { Children } from "../framework/createElement"

export default class UserError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "UserError"
    }
}

export function ThrowUserError(title: string, details?: string) {
    const error = <div>
        <span className="error-context">{title}</span>
    </div>
    if (details) {
        error.append(<br />)
        error.append(<span className="full-error">{details}</span>)
    }
    throw error
}

export function userErrorMessage(e: unknown, extraContext?: Children): Children {
    let res: Children

    if (e instanceof UserError) res = e.message
    else if (e instanceof Node) res = e
    else res = String(e)

    if (extraContext) {
        // can't use document fragment with tooltips
        res = <div>
            <span className="error-context">{extraContext}</span>
            <br />
            <span className="full-error">{res}</span>
        </div>
    }
    return res
}

export function ErrorDisplay(e: string) {
    return <div className="error-text-display">{e}</div>
}