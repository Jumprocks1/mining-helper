import { getPortal, MarkPopoverClosed, OpenPopovers, TrackOpenPopover } from "../components/basic/JsPopover";
import { Component } from "../framework/Component";
import { replaceChildren } from "../framework/createElement";

interface CommandInfo {
    name: string
    filterString: string
    action: () => void
}

let commands: CommandInfo[] | undefined
function GetCommands() {
    if (!commands) {
        const c: CommandInfo[] = []
        function add(name: string, action: () => void) {
            c.push({ name, action, filterString: name.toLowerCase() })
        }
        add("Pink Noise", () => {
            console.log("TODO")
        })
        commands = c
    }
    return commands
}


class CommandPalette extends Component {
    Node: HTMLElement
    IsOpen = false
    CloseOnClickaway = true
    Input = <input placeholder="Type to search commands" /> as HTMLInputElement
    Results = <div className="results" />
    Selected?: CommandInfo

    constructor() {
        super()
        this.Node = <div id="command-palette">
            <div className="backdrop" onpointerdown={() => this.Close()} />
            <div className="inner-palette">
                {this.Input}
                {this.Results}
            </div>
        </div>
        this.Input.oninput = () => this.RefreshResults()
        this.Input.onkeydown = e => {
            if (e.key === "Enter") {
                this.Select()
            }
        }
    }

    Select() {
        this.Close()
        const command = this.Selected
        if (!command) return
        this.Run(command)
    }

    Run(command: CommandInfo) {
        command.action()
    }

    FilterCommands(query: string) {
        const commands = GetCommands()
        if (!query.trim()) return commands
        const spl = query.toLowerCase().split(" ").filter(e => e)
        let o: CommandInfo[] = []
        for (const e of commands) {
            if (spl.every(s => e.filterString.includes(s)))
                o.push(e)
        }
        return o
    }

    RefreshResults() {
        const commands = this.FilterCommands(this.Input.value)
        if (commands.length === 0) {
            this.Selected = undefined
            replaceChildren(this.Results, <div className="not-found">No commands found</div>)
            return
        }
        let found = false
        const divs = commands.map(e => {
            const o = <div>
                {e.name}
            </div>
            if (e === this.Selected) {
                found = true
                o.classList.add("selected")
            }
            return o
        })
        if (!found) {
            this.Selected = commands[0]
            divs[0].classList.add("selected")
        }
        replaceChildren(this.Results, divs)
    }

    Open() {
        if (this.IsOpen) return
        if (this.Node.id) OpenPopovers.find(e => e.Node?.id === this.Node.id)?.Close()
        TrackOpenPopover(this)
        this.IsOpen = true
        this.Input.value = ""
        getPortal().append(this.Node)
        this.Input.focus()
        this.RefreshResults()
    }

    Close() {
        if (!this.IsOpen) return
        MarkPopoverClosed(this)
        this.IsOpen = false;
        this.Node.remove()
    }
}

let instance: CommandPalette | undefined = undefined

export function RegisterCommandPalette() {
    document.addEventListener("keydown", e => {
        if (e.key === "F1") {
            OpenCommandPalette()
            e.preventDefault()
        }
    })


    setTimeout(OpenCommandPalette, 30)
}

export function OpenCommandPalette() {
    (instance ??= new CommandPalette()).Open()
    return instance
}