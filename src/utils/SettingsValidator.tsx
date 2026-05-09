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

    constructor() {
        this.Node = <div className="validation-result" />
    }

    ReplaceEntireOutput(e: Children) {
        replaceChildren(this.Node, e)
    }

    Pass(e: Children) {
        appendChild(this.Node, <div className="row">{CheckIcon()}{e}</div>)
    }
    // not for a specific step, usually at the end if everything is good
    SuccessMessage(e: Children) {
        appendChild(this.Node, <div className="success">{e}</div>)
    }
    Warn(e: Children) {
        this.HasWarnings = true
        appendChild(this.Node, <div className="warning">{e}</div>)
    }

    AppendOutput(e: Children) {
        appendChild(this.Node, e)
    }

    async Test(testMethod: (tester: SettingsValidator) => void | Promise<void> | Children | Promise<Children>) {
        try {
            const res = await testMethod(this)
            if (res) this.ReplaceEntireOutput(res)
        } catch (e) {
            this.HasErrors = true
            let node: Children
            if (typeof e === "string")
                node = <div className="error">{e}</div>
            else
                node = userErrorMessage(e)
            if (this.ReplaceOutputOnError)
                this.ReplaceEntireOutput(node)
            else
                appendChild(this.Node, node)
        }
    }
}