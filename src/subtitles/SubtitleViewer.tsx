import { UnicodeCharacterType, unicodeType } from "../anki/CardList"
import { formatTimestamp, SubtitleEntry, Subtitles } from "../utils/srt"
import { oldCreateElement } from "../utils/util"

declare global {
    interface HTMLElement {
        subtitleEntry?: SubtitleEntry
    }
}

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
                    <div className="subtitles">{entry.text}</div>
                ]
            }))
            entry.node.subtitleEntry = entry
        }
        inner.replaceChildren(...newChildren)
    }

    JumpTo(entry: SubtitleEntry | undefined) {
        if (!entry) return
        const node = entry.node
        const scroll = document.getElementById("body-container")
        if (!scroll || !node) return
        const computedStyle = getComputedStyle(scroll);
        const paddingTop = parseFloat(computedStyle.paddingTop);
        const center = node.offsetTop + node.offsetHeight / 2 + paddingTop;
        scroll.scrollTo({ top: center - scroll.clientHeight / 5 });
    }

    LatestEntry(currentTime: number) {
        let latest: SubtitleEntry | undefined = undefined
        for (const entry of this.subtitles.entries) {
            if (entry.startTime <= currentTime)
                latest = entry
            else
                break;
        }
        return latest
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

        // this is pretty inefficient
        for (const entry of this.subtitles.entries) {
            const node = entry.node
            if (node) {
                if (entry.startTime <= currentTime && entry.endTime > currentTime) {
                    // only scroll if we add a new highlight
                    if (!node.classList.contains("highlight")) {
                        node.classList.add("highlight")
                        if (this.main) {
                            const computedStyle = getComputedStyle(scroll);
                            const paddingTop = parseFloat(computedStyle.paddingTop);
                            const center = node.offsetTop + node.offsetHeight / 2 + paddingTop;

                            if (scroll.scrollTop > center - scroll.clientHeight / 5
                                || scroll.scrollTop < center - scroll.clientHeight * (1 - 1 / 5)) {
                                scroll.scrollTo({ top: center - scroll.clientHeight / 5 });
                            }
                        }
                    }
                } else {
                    node.classList.remove("highlight")
                }
            }
        }
    }

    async HighlightAnkiWords() {
        const ankiWords = (await chrome.storage.local.get({ ankiWords: [] })).ankiWords
        const knownCharacters = new Set<string>()
        for (const word of ankiWords) {
            for (const c of word) {
                knownCharacters.add(c)
            }
        }
        const nodes = this.Node.querySelectorAll(".subtitle-entry .subtitles")
        let pendingText = ""
        let pendingStyle = "none"
        function pushPending(node: ParentNode) {
            if (pendingText) {
                if (pendingStyle === "none")
                    node.append(pendingText)
                else
                    node.append(<span className={pendingStyle}>{pendingText}</span>)
            }
            pendingText = ""
            pendingStyle = "none"
        }
        function pushCharacter(node: ParentNode, c: string, style: string) {
            if (pendingStyle === style) pendingText += c
            else {
                pushPending(node)
                pendingText = c
                pendingStyle = style
            }
        }
        for (const node of nodes) {
            const text = node.textContent
            node.replaceChildren()
            for (const character of text) {
                if (!knownCharacters.has(character) && unicodeType(character) === UnicodeCharacterType.Kanji)
                    pushCharacter(node, character, "unknown")
                else
                    pushCharacter(node, character, "none")
            }
            pushPending(node)
        }
    }
}