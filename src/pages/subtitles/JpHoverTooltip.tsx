import { JsPopover } from "../../components/basic/JsPopover";
import { Children } from "../../framework/createElement";
import { onDeath } from "../../framework/Observer";
import { SmallTooltip } from "../../framework/Tooltips";
import { JpdbVocabulary } from "../../jpdb/JpdbParseText";
import { getVocabStateAndNote, VocabState } from "../../jpdb/JpdbState";
import AnkiConnect from "../../utils/AnkiConnect";
import { getHoveredCharacterIndex } from "../../utils/CharacterHighlighter";
import { furiToRuby } from "../../utils/util";

export default class JpHoverTooltip extends JsPopover {

    constructor(anchor?: HTMLElement) {
        super({
            anchor,
            id: "jp-hover-tooltip",
            type: "js-tooltip"
        })
    }

    Target(target: HTMLElement | Range, vocab: JpdbVocabulary) {
        if (!vocab.furigana) this.Close()
        if (target instanceof HTMLElement) {
            this.Anchor = target
            this.Node.style.left = `anchor(left)`
            this.Node.style.top = `anchor(bottom)`
        } else {
            if (!this.Anchor) return
            const parentRect = this.Anchor.getBoundingClientRect()
            const rect = target.getBoundingClientRect()
            const x = rect.left - parentRect.left
            const y = rect.bottom - parentRect.top
            this.Node.style.left = `calc(anchor(left) + ${x}px)`
            this.Node.style.top = `calc(anchor(top) + ${y}px)`
        }
        this.TargetBase(vocab)
    }

    LoadedVocab: JpdbVocabulary | undefined

    private TargetBase(vocab: JpdbVocabulary) {
        if (this.LoadedVocab === vocab) {
            this.Open()
            return
        }
        this.LoadedVocab = vocab
        const [vocabState, vocabNote] = getVocabStateAndNote(vocab, { trimKana: true })

        const vocabStateString = VocabState[vocabState].toLowerCase()
        let vocabStateNode: Children = vocabStateString
        if (vocabState === VocabState.AltSpelling || vocabState === VocabState.Known || vocabState === VocabState.Similar) {
            const target = vocabState === VocabState.Known ? vocabNote ?? vocab[0] : vocabNote
            if (target) {
                vocabStateNode = <button className="link-button uncolored"
                    tooltip="Open in Anki" tooltipConfig={SmallTooltip}
                    onclick={() => AnkiConnect.call("guiBrowse", { query: `word:${target}` })}>
                    {vocabStateString}
                </button>
            }
        }

        const ruby = furiToRuby(vocab.furigana)

        this.SetContent(<>
            <div className="header">
                {ruby}
                <span className={"vocab-state " + vocabStateString}>
                    {vocabStateNode}{vocabNote ? <> - {vocabNote}</> : undefined}
                </span>
                <span className="frequency">{vocab[2]}</span>
            </div>
            {vocab[3].map((e, i) => <div>
                {i + 1}. {e}
            </div>)}
        </>)
        this.Open()
    }
}



// TODO would love to share this with SubtitleViewer
// Not quite as simple as I wanted since SubtitleViewer also relies on the hover state for underlining
// We'll need to change loadedTooltip to also work for returning the currently hovered characters (even if there's no tooltip present)

interface TooltipHandler {
    body: HTMLElement,
    getTargetAndVocab: (node: Node) => [HTMLElement | Range, JpdbVocabulary] | undefined,
    invert: boolean
}
const kanjiTooltipHandlers: TooltipHandler[] = []
let globalHandlerRegistered = false
interface HoverState {
    vocab: JpdbVocabulary,
    handler: TooltipHandler,
    tooltip: boolean
    target: HTMLElement | Range
}
let loadedHover: HoverState | undefined
let popover: JpHoverTooltip | undefined // this can end up set but with open false
let mouseX: number | undefined
let mouseY: number | undefined

function mousemove(ev: MouseEvent) {
    mouseX = ev.clientX
    mouseY = ev.clientY
    if (loadedHover?.tooltip) {
        // if there's a visible tooltip, don't close it when we move the mouse over it with the inverted open state
        const showTooltip = ev.shiftKey !== loadedHover.handler.invert
        // popover should never be undefined here
        if (popover && !showTooltip) {
            if (popover.Node.contains(ev.target as HTMLElement)) return
        }
    }
    UpdateHoverState(ev.shiftKey)
}
function keyupdown(ev: KeyboardEvent) {
    if (ev.key !== "Shift") return
    if (loadedHover?.tooltip) {
        // in a normal scenario, this means we have an open tooltip (opened by holding shift)
        // if we are no longer holding shift, that tooltip cannot be dismissed by a keypress
        const showTooltip = ev.shiftKey !== loadedHover.handler.invert
        if (!showTooltip) return
    }
    UpdateHoverState(ev.shiftKey)
}

function setHoverState(state: HoverState | undefined, shiftKey: boolean) {
    if (state === undefined) {
        if (loadedHover?.tooltip) {
            popover?.Close()
            loadedHover = undefined
            // we immediately call this since `Close` can cause a new character to become hovered
            // have to be careful for infinite loops
            UpdateHoverState(shiftKey)
            return
        }
        loadedHover = undefined
        return
    }

    // TODO underline?
    if (!state.tooltip) {
        loadedHover = state
        if (popover?.IsOpen) {
            popover?.Close()
            UpdateHoverState(shiftKey)
        }
        return
    }
    loadedHover = state
    popover ??= new JpHoverTooltip()
    popover.Target(state.target, state.vocab)
}

function UpdateHoverState(shiftKey: boolean) {
    // Only call this method after confirming the event target isn't inside the popover already
    if (kanjiTooltipHandlers.length === 0) return
    if (mouseX === undefined || mouseY === undefined) return
    const res = getHoveredCharacterIndex(mouseX, mouseY)
    if (!res) return setHoverState(undefined, shiftKey) // if we're not hovering anything, reset everything
    const [hoverNode, character] = res
    let matched = false
    for (const handler of kanjiTooltipHandlers) {
        matched = UpdateHoverStateSingle(hoverNode, handler, shiftKey)
        if (matched) break
    }
    if (!matched) {
        // If the currently hovered node has no vocab info for any handlers, close everything
        setHoverState(undefined, shiftKey)
    }
}
function UpdateHoverStateSingle(hoverNode: Node, handler: TooltipHandler, shiftKey: boolean): boolean {
    if (!handler.body.contains(hoverNode)) return false
    const targetAndVocab = handler.getTargetAndVocab(hoverNode)
    if (!targetAndVocab) return false

    const [target, vocab] = targetAndVocab
    const showTooltip = shiftKey !== handler.invert
        // The || means if as long as we continue hovering the same target, we keep showing the tooltip
        || Boolean(loadedHover?.tooltip && targetsEqual(loadedHover.target, target))

    setHoverState({ vocab, handler, tooltip: showTooltip, target }, shiftKey)
    return true
}

function targetsEqual(a: HTMLElement | Range, b: HTMLElement | Range) {
    if (a instanceof HTMLElement || b instanceof HTMLElement) return a === b
    return a.compareBoundaryPoints(Range.START_TO_START, b) === 0 &&
        a.compareBoundaryPoints(Range.END_TO_END, b) === 0
}

// can safely modify invert in handler object
export function RegisterJpHoverTooltip(handler: TooltipHandler) {
    if (!globalHandlerRegistered) {
        globalHandlerRegistered = true
        document.addEventListener("mousemove", mousemove)
        document.addEventListener("keyup", keyupdown)
        document.addEventListener("keydown", keyupdown)
    }
    kanjiTooltipHandlers.push(handler)
    onDeath(handler.body, () => {
        for (let i = kanjiTooltipHandlers.length - 1; i >= 0; i--) {
            if (kanjiTooltipHandlers[i].body === handler.body) {
                kanjiTooltipHandlers.splice(i, 1)
            }
        }
    })
    return handler
}
