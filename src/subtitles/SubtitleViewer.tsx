import { UnicodeCharacterType, unicodeType } from "../anki/CardList"
import { Popover } from "../components/basic/Popover"
import { JpdbParseResponse } from "../jpdb/JpdbParseText"
import { getHoveredCharacterIndex } from "../utils/CharacterHighlighter"
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

    hoverRectangle: HTMLElement = <div className="hover-rectangle" />
    popover: Popover | undefined

    // use to block scrolling when selecting
    MouseDown = false

    constructor(subtitles: Subtitles, main: boolean) {
        this.main = main
        this.Node = <div className="subtitle-viewer">
            {this.pointer}
            <div className="inner"></div>
            {this.hoverRectangle}
        </div>
        if (main) this.Node.id = SubtitleViewer.MAIN_ID
        this.subtitles = subtitles
        this.updateBlock()

        this.Node.addEventListener("pointerdown", () => {
            this.MouseDown = true
        })
        this.Node.addEventListener("pointerup", () => {
            this.MouseDown = false
        })

        let x: number | undefined = undefined
        let y: number | undefined = undefined
        document.addEventListener("keydown", ev => {
            if (this.subtitles.jpdbParse) {
                if (this.popover) {
                    if (this.popover.Node.contains(ev.target as HTMLElement)) return
                }
                if (x !== undefined && y !== undefined)
                    this.UpdateHoverInfo(x, y, ev.shiftKey)
            }
        })

        this.Node.addEventListener("mousemove", ev => {
            x = ev.clientX
            y = ev.clientY
            if (this.subtitles.jpdbParse) {
                if (this.popover) {
                    if (this.popover.Node.contains(ev.target as HTMLElement)) return
                }
                this.UpdateHoverInfo(x, y, ev.shiftKey)
            }
        })
    }

    UpdateHoverBox(rect: DOMRect | undefined) {
        if (!rect) {
            this.hoverRectangle.classList.add("hide")
            return
        }
        else this.hoverRectangle.classList.remove("hide")
        const parent = this.hoverRectangle.parentElement
        if (!parent) return

        const parentRect = parent.getBoundingClientRect()

        this.hoverRectangle.style.width = rect.width + "px"
        this.hoverRectangle.style.height = rect.height + "px"
        this.hoverRectangle.style.top = rect.top - parentRect.top + "px"
        this.hoverRectangle.style.left = rect.left - parentRect.left + "px"
    }

    LoadedVocab: JpdbParseResponse["vocabulary"][number] | undefined

    SetHoverState(rect: DOMRect | undefined, vocab: JpdbParseResponse["vocabulary"][number] | undefined, shift: boolean) {
        this.UpdateHoverBox(rect)
        if (!shift && vocab && vocab !== this.LoadedVocab) vocab = undefined
        if (vocab && rect) {
            if (!this.popover) {
                this.popover = new Popover({
                    side: "below",
                    position: "absolute"
                })
                this.Node.append(this.popover.Node)
            }
            this.LoadedVocab = vocab
            const parent = this.popover.Node.parentElement!
            const parentRect = parent.getBoundingClientRect()
            // TODO try fragment
            this.popover.SetContent([
                <div className="header">{vocab[0]}<span className="frequency">{vocab[2]}</span></div>,
                <div className="reading">{vocab[1]}</div>,
                vocab[3].map((e, i) => <div>
                    {i + 1}. {e}
                </div>)
            ])
            // +2 for outline offset
            this.popover.Show(rect.left - parentRect.left, rect.bottom - parentRect.top)
        } else {
            this.LoadedVocab = undefined
            this.popover?.Hide()
        }
    }

    UpdateHoverInfo(x: number, y: number, shift: boolean) {
        const jpdb = this.subtitles.jpdbParse
        if (!jpdb) return
        const res = getHoveredCharacterIndex(x, y)
        if (!res) {
            this.SetHoverState(undefined, undefined, shift)
            return
        }
        const htmlElement = res[0].parentElement!
        const subtitles = htmlElement.closest(".subtitles")
        if (!subtitles) return
        const entry = subtitles.closest<HTMLElement>(".subtitle-entry")?.subtitleEntry
        if (!entry) return
        const processedEntry = this.subtitles.processedEntries[entry.index]
        const offset = processedEntry.characterOffset + res[1]
        let token: JpdbParseResponse["tokens"][number] | undefined = undefined
        // this is probably really slow, could do binary search
        for (const e of jpdb.tokens) {
            if (e[0] <= offset && e[0] + e[1] > offset) {
                token = e
                break
            }
        }
        if (token) {
            const range = document.createRange()
            range.setStart(res[0], token[0] - processedEntry.characterOffset)
            range.setEnd(res[0], token[0] - processedEntry.characterOffset + token[1])
            const rect = range.getBoundingClientRect()
            this.SetHoverState(rect, jpdb.vocabulary[token[3]], shift)
        }
    }

    updateBlock() {
        const inner = this.Node.querySelector(":scope > .inner")
        if (!inner) return
        const newChildren: Node[] = []
        for (const entry of this.subtitles.processedEntries) {
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
        for (const entry of this.subtitles.processedEntries) {
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
        for (let i = 0; i < this.subtitles.processedEntries.length; i++) {
            const entry = this.subtitles.processedEntries[i]
            const node = entry.node
            if (node) {
                if (entry.startTime <= currentTime && entry.endTime > currentTime) {
                    this.pointer.style.top = node.offsetTop + node.offsetHeight / 2 + "px"
                    break
                }
                if (entry.startTime > currentTime) {
                    const prevEntry = i > 0 ? this.subtitles.processedEntries[i - 1] : undefined
                    const prevTime = prevEntry?.endTime ?? 0
                    const prevPos = (prevEntry && prevEntry.node) ?
                        prevEntry.node.offsetTop + prevEntry.node.clientHeight / 2 : 0
                    const a = (currentTime - prevTime) / (entry.startTime - prevTime)
                    this.pointer.style.top = prevPos + (node.offsetTop + node.offsetHeight / 2 - prevPos) * a + "px"
                    break
                }
            }
        }

        // technically can break if mouse up doesn't fire, but it's pretty solid
        const allowScroll = this.main && !this.MouseDown

        // this is pretty inefficient
        for (const entry of this.subtitles.processedEntries) {
            const node = entry.node
            if (node) {
                if (entry.startTime <= currentTime && entry.endTime > currentTime) {
                    // only scroll if we add a new highlight
                    if (!node.classList.contains("highlight")) {
                        node.classList.add("highlight")
                        if (allowScroll) {
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