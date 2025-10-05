import { formatTimestamp, Subtitles } from "../utils/srt"
import { oldCreateElement } from "../utils/util"

export default class SubtitleViewer {
    Node: HTMLElement
    subtitles: Subtitles
    main: boolean
    pointer: HTMLElement = <div className="pointer">-&gt;</div>
    static readonly MAIN_ID = "main-subtitles";



    constructor(subtitles: Subtitles, main: boolean) {
        this.main = main
        this.Node = <div className="subtitle-viewer">
            {this.pointer}
            <div className="inner"></div>
        </div>
        if (main) this.Node.id = SubtitleViewer.MAIN_ID
        this.subtitles = subtitles
        this.updateBlock()
    }

    updateBlock() {
        const inner = this.Node.querySelector(":scope > .inner")
        if (!inner) return
        const newChildren: Node[] = []
        for (const entry of this.subtitles.entries) {
            newChildren.push(entry.node = oldCreateElement("div", {
                className: "subtitle-entry",
                children: [
                    oldCreateElement("span", {
                        className: "timestamp",
                        textContent: formatTimestamp(entry.startTime),
                        mutate: (e: any) => e.entry = entry
                    }),
                    oldCreateElement("div", {
                        className: "subtitles",
                        children: [
                            oldCreateElement("span", {
                                className: "main-subtitle",
                                textContent: entry.text,
                                data: {
                                    tooltip: entry.translation
                                }
                            }),
                        ]
                    })
                ]
            }))
        }
        inner.replaceChildren(...newChildren)
    }


    UpdateHighlighting(currentTime: number) {
        const scroll = document.getElementById("body-container")
        if (!scroll) return
        for (let i = 0; i < this.subtitles.entries.length; i++) {
            const entry = this.subtitles.entries[i]
            const node = entry.node
            if (node) {
                if (entry.startTime <= currentTime && entry.endTime > currentTime) {
                    this.pointer.style.top = node.offsetTop + node.offsetHeight / 2 + "px"
                    break
                }
                if (entry.startTime > currentTime) {
                    const prevEntry = i > 0 ? this.subtitles.entries[i - 1] : undefined
                    const prevTime = prevEntry?.endTime ?? 0
                    const prevPos = (prevEntry && prevEntry.node) ?
                        prevEntry.node.offsetTop + prevEntry.node.clientHeight / 2 : 0
                    const a = (currentTime - prevTime) / (entry.startTime - prevTime)
                    this.pointer.style.top = prevPos + (node.offsetTop + node.offsetHeight / 2 - prevPos) * a + "px"
                    break
                }
            }
        }
        for (const entry of this.subtitles.entries) {
            const node = entry.node
            if (node) {
                if (entry.startTime <= currentTime && entry.endTime > currentTime) {
                    // only scroll if we add a new highlight
                    if (!node.classList.contains("highlight")) {
                        node.classList.add("highlight")
                        if (this.main) {
                            const center = node.offsetTop + node.offsetHeight / 2;
                            const scrollHeight = scroll.clientHeight
                            if (center < scroll.scrollTop + scroll.clientHeight / 6
                                || center > scroll.scrollTop + scroll.clientHeight * (1 - 1 / 6)) {
                                scroll.scrollTo({ top: center - scrollHeight / 6 });
                            }
                        }
                    }
                } else {
                    node.classList.remove("highlight")
                }
            }
        }
    }
}