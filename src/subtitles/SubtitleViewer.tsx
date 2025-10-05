import { formatTimestamp, Subtitles } from "../utils/srt"
import { oldCreateElement } from "../utils/util"

function updateBlock(block: HTMLElement, subtitles: Subtitles) {
    const inner = block.querySelector(":scope > .inner")
    if (!inner) return
    const newChildren: Node[] = []
    for (const entry of subtitles.entries) {
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

export default (subtitles: Subtitles) => {
    const res = <div className="subtitle-viewer">
        <div className="pointer">-&gt;</div>
        <div className="inner"></div>
    </div>
    updateBlock(res, subtitles);
    return res
}