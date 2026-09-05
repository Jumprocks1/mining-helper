import { Icon } from "../components/basic/IconButton"
import { appendChild, Children, replaceChildren } from "../framework/createElement"
import { userErrorMessage } from "./UserError"


export function CheckIcon() {
    return <Icon icon="check" className="check" />
}

// TODO rename/merge with validate.tsx
export default class SettingsValidator {
    Node: HTMLElement
    ReplaceOutputOnError = false
    HasWarnings = false
    HasErrors = false
    ShowLoading = false
    Container: HTMLElement

    constructor() {
        this.Node = <div className="validation-result">
            {this.Container = <div />}
        </div>
    }

    ReplaceEntireOutput(e: Children) {
        replaceChildren(this.Container, e)
    }

    Pass(e: Children) {
        appendChild(this.Container, <div className="row">{CheckIcon()}{e}</div>)
    }
    // not for a specific step, usually at the end if everything is good
    SuccessMessage(e: Children) {
        appendChild(this.Container, <div className="success">{e}</div>)
    }
    Warn(e: Children) {
        this.HasWarnings = true
        appendChild(this.Container, <div className="warning">{e}</div>)
    }

    Error(e: Children) {
        this.HasErrors = true
        appendChild(this.Container, <div className="error">{e}</div>)
    }
    ErrorIcon(e: Children) {
        this.HasErrors = true
        appendChild(this.Container, <div className="row">
            <Icon icon="error" className="error" />
            {e}
        </div>)
    }

    AppendOutput(e: Children) {
        appendChild(this.Container, e)
    }

    HandleException(e: unknown) {
        this.HasErrors = true
        let node: Children
        if (typeof e === "string")
            node = <div className="error">{e}</div>
        else
            node = userErrorMessage(e)
        if (this.ReplaceOutputOnError)
            this.ReplaceEntireOutput(node)
        else
            this.AppendOutput(node)
    }

    // TODO this could take a lambda with another try-catch
    Section(title: string) {
        this.AppendOutput(<h3>{title}</h3>)
    }

    async Test(testMethod: (tester: SettingsValidator) => void | Promise<void> | Children | Promise<Children>) {
        let loader: HTMLElement | undefined
        if (this.ShowLoading) this.Node.append(loader = <div className="loader" />)
        try {
            const res = await testMethod(this)
            if (res) this.ReplaceEntireOutput(res)
        } catch (e) {
            this.HandleException(e)
        }
        loader?.remove()
    }
}