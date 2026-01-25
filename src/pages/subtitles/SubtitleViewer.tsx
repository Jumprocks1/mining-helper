import { getAnkiWords } from "../../pages/anki/CardList"
import { JpdbParseResponse, JpdbToken, JpdbVocabulary } from "../../jpdb/JpdbParseText"
import { getVocabState, getVocabStateAndNote, VocabState } from "../../jpdb/JpdbState"
import { getCharacterIndex, getHoveredCharacterIndex, getSelectionRange } from "../../utils/CharacterHighlighter"
import { formatTimestamp, SubtitleEntry, SubtitleEntryWithCharacterOffset, Subtitles } from "../../utils/srt"
import { furiFromToken, furiToRuby, oldCreateElement } from "../../utils/util"
import { setSetting } from "../../views/SettingsModal"
import SubtitlesPage from "./subtitles"
import { UnicodeCharacterType, unicodeType } from "../../utils/AnkiUtil"
import { JsPopover } from "../../components/basic/JsPopover"

declare global {
    interface HTMLElement {
        subtitleEntry?: SubtitleEntryWithCharacterOffset
    }
}

type HoverState = { token: JpdbToken, rect: DOMRect }

export default class SubtitleViewer {
    Node: HTMLElement
    subtitles: Subtitles
    pointer: HTMLElement = <div className="pointer">-&gt;</div>

    hoverRectangle: HTMLElement = <div className="hover-rectangle" />
    popover: JsPopover | undefined

    Page: SubtitlesPage

    // use to block scrolling when selecting
    MouseDown = false

    MouseX: number | undefined
    MouseY: number | undefined

    DocumentKeydown(ev: KeyboardEvent) {
        if (this.subtitles.jpdbParse) {
            const showPopover = ev.shiftKey !== this.ShowHoverWithoutShift
            if (this.popover?.IsOpen && !showPopover) return
            this.UpdateHoverInfo(showPopover)
        }
    }

    constructor(subtitles: Subtitles, page: SubtitlesPage) {
        this.Page = page
        this.Node = <div className="subtitle-viewer">
            {this.pointer}
            <div className="inner"></div>
            {this.hoverRectangle}
        </div>
        this.subtitles = subtitles
        this.Node.addEventListener("click", ev => {
            const clicked = ev.target as HTMLElement | null
            if (clicked) {
                if (clicked.classList.contains("timestamp")) {
                    const entry = (clicked as any).entry
                    if (!entry) return
                    const time = entry.startTime
                    if (ev.ctrlKey) {
                        const subs = this.subtitles
                        setSetting("offset", (subs?.offset ?? 0) + page.CurrentTime - entry.startTime)
                    } else {
                        if (page.MpvWebSocket.Open) page.MpvWebSocket.SendIfOpen(`ipc:seek ${time / 1000} absolute`)
                        else page.UpdateTime(time)
                    }
                    ev.preventDefault();
                }
            }
        })
        this.updateBlock()

        this.Node.addEventListener("pointerdown", () => {
            this.MouseDown = true
        })
        this.Node.addEventListener("pointerup", () => {
            this.MouseDown = false
        })

        this.Node.addEventListener("mousemove", ev => {
            this.MouseX = ev.clientX
            this.MouseY = ev.clientY
            if (this.subtitles.jpdbParse) {
                const showPopover = ev.shiftKey !== this.ShowHoverWithoutShift
                if (this.popover && !showPopover) {
                    if (this.popover.Node.contains(ev.target as HTMLElement)) return
                }
                this.UpdateHoverInfo(showPopover)
            }
        })

        // make sure anki words are loaded for later, this caches the result
        // no harm in calling multiple times if promise isn't resolved yet
        getAnkiWords()
    }


    ShowHoverWithoutShift = false
    // toggles whether or not shift needs to be held down to show additional information about the hovered word
    ToggleShift() {
        this.ShowHoverWithoutShift = !this.ShowHoverWithoutShift
        this.UpdateHoverInfo(false)
    }

    LoadedHoverState: HoverState | undefined
    UpdateHoverBox(hoverState: HoverState | undefined, vocab: JpdbVocabulary | undefined) {
        if (this.LoadedHoverState?.token === hoverState?.token) return
        this.LoadedHoverState = hoverState
        if (!hoverState) {
            this.hoverRectangle.classList.add("hide")
            return
        }
        const parent = this.hoverRectangle.parentElement
        if (!parent) return

        // remove all other classes
        this.hoverRectangle.className = "hover-rectangle"

        const parentRect = parent.getBoundingClientRect()

        if (vocab) {
            const state = getVocabState(vocab, { trimKana: true })
            if (state === VocabState.Known)
                this.hoverRectangle.classList.add("known")
            else if (state === VocabState.Similar || state === VocabState.AltSpelling)
                this.hoverRectangle.classList.add("similar")
            else if (state !== VocabState.New)
                this.hoverRectangle.classList.add("ignore")
        }

        this.hoverRectangle.style.width = hoverState.rect.width + "px"
        this.hoverRectangle.style.height = hoverState.rect.height + "px"
        this.hoverRectangle.style.top = hoverState.rect.top - parentRect.top + "px"
        this.hoverRectangle.style.left = hoverState.rect.left - parentRect.left + "px"
    }

    LoadedPopoverVocab: JpdbVocabulary | undefined

    SetHoverState(hoverState: HoverState | undefined, vocab: JpdbVocabulary | undefined, shift: boolean) {
        this.UpdateHoverBox(hoverState, vocab)
        if (!shift && vocab && vocab !== this.LoadedPopoverVocab) vocab = undefined
        if (this.LoadedPopoverVocab === vocab) return
        this.LoadedPopoverVocab = vocab

        if (vocab && hoverState) {
            if (!this.popover) {
                this.popover = new JsPopover({
                    anchor: this.Node,
                    id: "jp-hover-tooltip"
                })
            }
            const parentRect = this.Node.getBoundingClientRect()
            const [vocabState, vocabNote] = getVocabStateAndNote(vocab, { trimKana: true })
            const vocabStateString = VocabState[vocabState].toLowerCase()

            const ruby = furiToRuby(furiFromToken(vocab[0], hoverState.token))

            this.popover.SetContent(<>
                <div className="header">
                    {ruby}
                    <span className={"vocab-state " + vocabStateString}>
                        {vocabStateString}{vocabNote ? <> - {vocabNote}</> : undefined}
                    </span>
                    <span className="frequency">{vocab[2]}</span>
                </div>
                {vocab[3].map((e, i) => <div>
                    {i + 1}. {e}
                </div>)}
            </>)
            this.popover.Open()
            const x = hoverState.rect.left - parentRect.left
            const y = hoverState.rect.bottom - parentRect.top
            this.popover.Node.style.left = `calc(anchor(left) + ${x}px)`
            this.popover.Node.style.top = `calc(anchor(top) + ${y}px)`
        } else {
            this.popover?.Close()
        }
    }

    UpdateHoverInfo(shift: boolean) {
        const jpdb = this.subtitles.jpdbParse
        if (!jpdb || !this.MouseX || !this.MouseY) return
        const res = getHoveredCharacterIndex(this.MouseX, this.MouseY)
        if (!res) {
            this.SetHoverState(undefined, undefined, shift)
            return
        }
        const htmlElement = res[0].parentElement!
        const subtitles = htmlElement.closest<HTMLElement>(".subtitles")
        if (!subtitles) return
        const entry = subtitles.closest<HTMLElement>(".subtitle-entry")?.subtitleEntry
        if (!entry) return
        const indexInParent = getCharacterIndex(subtitles, res[0], res[1])
        const offset = entry.characterOffset + indexInParent
        let token: JpdbParseResponse["tokens"][number] | undefined = undefined
        // this is probably really slow, could do binary search
        for (const e of jpdb.tokens) {
            if (e[0] <= offset && e[0] + e[1] > offset) {
                token = e
                break
            }
        }
        if (token) {
            const start = token[0] - entry.characterOffset
            const range = getSelectionRange(subtitles, start, start + token[1])
            const rect = range.getBoundingClientRect()
            this.SetHoverState({ token, rect }, jpdb.vocabulary[token[3]], shift)
        } else {
            this.SetHoverState(undefined, undefined, shift)
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
        const scroll = this.Page.InnerBodyContainer
        if (!node) return
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
        const scroll = this.Page.InnerBodyContainer
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
        const allowScroll = !this.MouseDown

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
        const ankiWords = await getAnkiWords()
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