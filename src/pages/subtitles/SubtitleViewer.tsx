import { getAnkiFurigana } from "../../pages/anki/CardList"
import { JpdbParseResponse, JpdbVocabulary } from "../../jpdb/JpdbParseText"
import { getVocabState, VocabState } from "../../jpdb/JpdbState"
import { getCharacterIndex, getSelectionRange } from "../../utils/CharacterHighlighter"
import { formatTimestamp, SubtitleEntry, SubtitleEntryWithCharacterOffset, Subtitles } from "../../utils/srt"
import { setSetting } from "../../views/SettingsModal"
import SubtitlesPage from "./subtitles"
import { UnicodeCharacterType, unicodeType } from "../../utils/AnkiUtil"
import { JpHoverTooltipHandler, JpHoverTooltipState, RegisterJpHoverTooltip, UpdateJpHover } from "./JpHoverTooltip"

declare global {
    interface HTMLElement {
        subtitleEntry?: SubtitleEntryWithCharacterOffset
    }
}

export default class SubtitleViewer {
    Node: HTMLElement
    subtitles: Subtitles
    pointer: HTMLElement = <div className="pointer">-&gt;</div>

    hoverRectangle: HTMLElement = <div className="hover-rectangle" />

    Page: SubtitlesPage

    // use to block scrolling when selecting
    MouseDown = false

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
                    const entry = clicked.subtitleEntry
                    if (!entry) return
                    const time = entry.startTime
                    if (ev.ctrlKey) {
                        const subs = this.subtitles
                        setSetting("offset", (subs?.offset ?? 0) + page.CurrentTime - entry.startTime)
                    } else {
                        if (page.MpvWebSocket.Open) page.MpvWebSocket.SendIfOpen(`seek:${time}`)
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

        this.TooltipHandler = RegisterJpHoverTooltip({
            body: this.Node,
            getTargetAndVocab: hovered => {
                const jpdb = this.subtitles.jpdbParse
                if (!jpdb) return
                const htmlElement = hovered[0].parentElement!
                const subtitles = htmlElement.closest<HTMLElement>(".subtitles")
                if (!subtitles) return
                const entry = subtitles.closest<HTMLElement>(".subtitle-entry")?.subtitleEntry
                if (!entry) return
                const indexInParent = getCharacterIndex(subtitles, hovered[0], hovered[1])
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
                    return [range, jpdb.vocabulary[token[3]], token]
                }
            },
            invert: false,
            onChange: state => this.UpdateHoverBox(state)
        })

        // make sure anki words are loaded for later, this caches the result
        // no harm in calling multiple times if promise isn't resolved yet
        getAnkiFurigana()
    }

    TooltipHandler: JpHoverTooltipHandler

    // toggles whether or not shift needs to be held down to show additional information about the hovered word
    ToggleShift() {
        this.TooltipHandler.invert = !this.TooltipHandler.invert
        UpdateJpHover(false)
    }

    UpdateHoverBox(hoverState: JpHoverTooltipState | undefined) {
        if (!hoverState) {
            this.hoverRectangle.classList.add("hide")
            return
        }
        const parent = this.hoverRectangle.parentElement
        if (!parent) return
        const vocab = hoverState.vocab

        // remove all other classes
        this.hoverRectangle.className = "hover-rectangle"

        const parentRect = parent.getBoundingClientRect()

        if (vocab) this.AddStateClass(this.hoverRectangle, vocab)
        const rect = hoverState.target.getBoundingClientRect()

        this.hoverRectangle.style.width = rect.width + "px"
        this.hoverRectangle.style.height = rect.height + "px"
        this.hoverRectangle.style.top = rect.top - parentRect.top + "px"
        this.hoverRectangle.style.left = rect.left - parentRect.left + "px"
    }

    updateBlock() {
        const inner = this.Node.querySelector(":scope > .inner")
        if (!inner) return
        const newChildren: Node[] = []
        for (const entry of this.subtitles.processedEntries) {
            const timestamp = <span className="timestamp">{formatTimestamp(entry.startTime)}</span>
            timestamp.subtitleEntry = entry
            newChildren.push(entry.node = <div className="subtitle-entry">
                {timestamp}
                <div className="subtitles">{entry.text}</div>
            </div>)
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

    AddStateClass(el: HTMLElement, vocab: JpdbVocabulary) {
        const state = getVocabState(vocab, { trimKana: true })
        if (state === VocabState.Known)
            el.classList.add("known")
        else if (state === VocabState.Similar || state === VocabState.AltSpelling)
            el.classList.add("similar")
        else if (state !== VocabState.New)
            el.classList.add("ignore")
    }

    async UnderlineWords() {
        await getAnkiFurigana() // needed for AddStateClass
        const jpdb = this.subtitles.jpdbParse
        if (!jpdb) return
        const underlined = Boolean(this.Node.querySelector(".subtitles .underline"))
        const tokens = jpdb.tokens
        let nextToken = 0
        for (let i = 0; i < this.subtitles.processedEntries.length; i++) {
            const entry = this.subtitles.processedEntries[i]
            const node = entry.node?.querySelector(".subtitles")
            if (node) {
                if (underlined) {
                    node.replaceChildren(entry.text)
                    continue
                }
                const children: (Node | string)[] = []
                let i = 0;
                while (i < entry.text.length) {
                    let s: HTMLElement | string
                    if (nextToken < tokens.length) {
                        const pos = entry.characterOffset + i
                        if (pos < tokens[nextToken][0]) {
                            s = entry.text.substring(i, tokens[nextToken][0] - entry.characterOffset)
                            i += s.length
                        } else {
                            s = <span className="underline">{entry.text.substring(i, i + tokens[nextToken][1])}</span>
                            this.AddStateClass(s, jpdb.vocabulary[tokens[nextToken][3]])
                            i += tokens[nextToken][1]
                            nextToken += 1;
                        }
                    } else {
                        s = entry.text.substring(i)
                        i += s.length
                    }
                    children.push(s)
                }
                node.replaceChildren(...children)
            }
        }
    }

    async HighlightAnkiWords() {
        const ankiFurigana = await getAnkiFurigana()
        const knownCharacters = new Set<string>()
        for (const furi of ankiFurigana) {
            for (const c of furi) {
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