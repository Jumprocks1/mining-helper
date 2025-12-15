import "../framework/createElement"
import { appendChild, Children } from "../framework/createElement"

export function seedPage(id: string, children: Children) {
    const body = document.body
    body.id = id
    body.replaceChildren()
    appendChild(body, children)
}