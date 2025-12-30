export default class UserError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "UserError"
    }
}

export function userErrorMessage(e: unknown) {
    if (e instanceof UserError) return e.message

    return String(e)
}