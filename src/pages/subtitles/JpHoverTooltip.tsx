import IconButton from "../../components/basic/IconButton";
import { JsPopover } from "../../components/basic/JsPopover";
import { Children } from "../../framework/createElement";
import { onDeath } from "../../framework/Observer";
import { ActionTooltip, SmallTooltip } from "../../framework/Tooltips";
import { Brand } from "../../framework/util";
import { IgnoreVid, UnIgnoreVid } from "../../jpdb/IgnoreList";
import { JpdbToken, JpdbVocabulary } from "../../jpdb/JpdbParseText";
import { getVocabState, getVocabStateAndNote, VocabState } from "../../jpdb/JpdbState";
import AnkiConnect from "../../utils/AnkiConnect";
import { playAudioThrow } from "../../utils/Audio";
import { getHoveredCharacterIndex, getTextRects } from "../../utils/CharacterHighlighter";
import { furiFromToken, furiToRuby } from "../../utils/util";

export default class JpHoverTooltip extends JsPopover {

    constructor(anchor?: HTMLElement) {
        super({
            anchor,
            id: "jp-hover-tooltip",
            type: "js-tooltip"
        })
    }

    Target(target: HTMLElement | Range, vocab: JpdbVocabulary, token?: JpdbToken) {
        if (!vocab.furigana) this.Close() // not sure what this line does
        if (target instanceof HTMLElement) {
            this.Node.style.removeProperty("left")
            this.Node.style.removeProperty("top")
            this.Anchor = target
        } else {
            this.AnchorToRange(target)
        }
        this.TargetBase(vocab, token)
    }

    LoadedVocab: JpdbVocabulary | undefined

    private TargetBase(vocab: JpdbVocabulary, token?: JpdbToken) {
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

        let furi = vocab.furigana
        if (token) {
            const tokenFuri = furiFromToken(vocab[0], token)
            if (tokenFuri.includes("[")) furi = tokenFuri
        }

        const ruby = furiToRuby(furi)

        let ignored = vocabState === VocabState.Ignored || vocabState === VocabState.TemporarilyIgnored
        const makeIgnoreButton = () => <IconButton icon={ignored ? "restore_from_trash" : "delete"}
            className="ignore-button"
            tooltip={ActionTooltip(ignored ? "Restore" : "Ignore", undefined, ignored ? undefined :
                "Hold ctrl to ignore for 30 days\nUseful for names/locations.")}
            onClick={async ev => {
                if (ignored) await UnIgnoreVid(vocab[5])
                else await IgnoreVid(vocab[5], vocab[0], ev.ctrlKey);
                this.LoadedVocab = undefined
                this.TargetBase(vocab, token)
            }} />
        let ignoreButton = (ignored || vocabState === VocabState.New) && makeIgnoreButton()


        this.SetContent(<>
            <div className="header">
                {ruby}
                <IconButton icon="play_arrow" onClick={() => playAudioThrow(vocab)} />
                <span className={"vocab-state " + vocabStateString}>
                    {vocabStateNode}{vocabNote ? <> - {vocabNote}</> : undefined}
                </span>
                {ignoreButton}
                <span className="frequency">{vocab[2]}</span>
            </div>
            {vocab[3].map((e, i) => <div>
                {i + 1}. {e}
            </div>)}
        </>)
        this.Open()
        this.FixPosition()
    }
}



export interface JpHoverTooltipHandler {
    body: HTMLElement,
    getTargetAndVocab: (hovered: readonly [Node, number]) =>
        [HTMLElement | Range, JpdbVocabulary, JpdbToken?] | undefined,
    invert: boolean
    onChange?: (hoverState: JpHoverTooltipState | undefined) => void
    forceSetHoverState?: (hoverState: JpHoverTooltipState) => void
}
const kanjiTooltipHandlers: JpHoverTooltipHandler[] = []
let globalHandlerRegistered = false
export interface JpHoverTooltipState {
    vocab: JpdbVocabulary,
    handler: JpHoverTooltipHandler,
    tooltip: boolean
    target: HTMLElement | Range
    token?: JpdbToken
}
let loadedHover: JpHoverTooltipState | undefined
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
    UpdateJpHover(ev.shiftKey)
}

// Assumes no mouse movement
export function UpdateJpHover(shiftKey: boolean) {
    if (loadedHover?.tooltip) {
        // in a normal scenario, this means we have an open tooltip (opened by holding shift)
        // if we are no longer holding shift, that tooltip cannot be dismissed by a keypress
        const showTooltip = shiftKey !== loadedHover.handler.invert
        if (!showTooltip) return
    }
    UpdateHoverState(shiftKey)
}

function setHoverState(state: JpHoverTooltipState | undefined, shiftKey: boolean) {
    if (targetsEqual(state?.target, loadedHover?.target) && state?.tooltip === loadedHover?.tooltip) return
    const oldHoverHandler = loadedHover?.handler
    _setHoverStateInner(state, shiftKey)
    // Careful: for these onChange handlers, we have to use loadedHover, not state
    // State can be out of date at this point since _setHoverStateInner can loadedHover
    // If that happens, we can end up calling these onChange handlers twice with the same loadedHover object
    // I think this could be fixed by refactor inner/outer setHoverState or maybe adding a third __ inner inner
    oldHoverHandler?.onChange?.(loadedHover)
    if (loadedHover && loadedHover.handler !== oldHoverHandler) loadedHover.handler.onChange?.(loadedHover)
}
function _setHoverStateInner(state: JpHoverTooltipState | undefined, shiftKey: boolean) {
    if (state === undefined) {
        if (loadedHover?.tooltip) {
            loadedHover = undefined
            if (popover?.IsOpen) {
                popover?.Close()
                // we immediately call this since `Close` can cause a new character to become hovered
                // have to be careful for infinite loops
                UpdateHoverState(shiftKey)
            }
            return
        }
        loadedHover = undefined
        return
    }

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
    if (state.target instanceof Range) popover.Anchor = state.handler.body
    popover.Target(state.target, state.vocab, state.token)
}

function UpdateHoverState(shiftKey: boolean) {
    // Only call this method after confirming the event target isn't inside the popover already
    if (kanjiTooltipHandlers.length === 0) return
    if (mouseX === undefined || mouseY === undefined) return
    const hovered = getHoveredCharacterIndex(mouseX, mouseY)
    if (!hovered) return setHoverState(undefined, shiftKey) // if we're not hovering anything, reset everything
    let matched = false
    for (const handler of kanjiTooltipHandlers) {
        matched = UpdateHoverStateSingle(hovered, handler, shiftKey)
        if (matched) break
    }
    if (!matched) {
        // If the currently hovered node has no vocab info for any handlers, close everything
        setHoverState(undefined, shiftKey)
    }
}
function UpdateHoverStateSingle(hovered: readonly [Node, number], handler: JpHoverTooltipHandler, shiftKey: boolean): boolean {
    if (!handler.body.contains(hovered[0])) return false
    const targetAndVocab = handler.getTargetAndVocab(hovered)
    if (!targetAndVocab) return false

    const [target, vocab, token] = targetAndVocab
    const showTooltip = shiftKey !== handler.invert
        // The || means if as long as we continue hovering the same target, we keep showing the tooltip
        || Boolean(loadedHover?.tooltip && targetsEqual(loadedHover.target, target))

    setHoverState({ vocab, handler, tooltip: showTooltip, target, token }, shiftKey)
    return true
}

function targetsEqual(a: HTMLElement | Range | undefined, b: HTMLElement | Range | undefined) {
    if (a === undefined || b === undefined || a instanceof HTMLElement || b instanceof HTMLElement) return a === b
    return a.compareBoundaryPoints(Range.START_TO_START, b) === 0 &&
        a.compareBoundaryPoints(Range.END_TO_END, b) === 0
}

// can safely modify invert in handler object
export function RegisterJpHoverTooltip(handler: JpHoverTooltipHandler) {
    if (!globalHandlerRegistered) {
        globalHandlerRegistered = true
        document.addEventListener("mousemove", mousemove)
        document.addEventListener("keyup", keyupdown)
        document.addEventListener("keydown", keyupdown)
    }
    handler.forceSetHoverState = state => setHoverState(state, false)
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

type HoverRectangleContainer = Brand<HTMLDivElement, "hover-rectangle-container">

export function HoverRectangleContainer() {
    return <div className="hover-rectangle-container" /> as HoverRectangleContainer
}


export function UpdateHoverBox(hoverRectangleContainer: HoverRectangleContainer, hoverState: JpHoverTooltipState | undefined) {
    hoverRectangleContainer.classList.toggle("hide", !hoverState)
    if (!hoverState) return
    const parent = hoverRectangleContainer.parentElement
    if (!parent) return

    const vocab = hoverState.vocab

    const parentRect = parent.getBoundingClientRect()
    const target = hoverState.target
    const rects = getTextRects(target)
    const children = hoverRectangleContainer.children
    while (children.length < rects.length) {
        hoverRectangleContainer.append(<div className="hover-rectangle" />)
    }
    const state = getVocabState(vocab, { trimKana: true })
    for (let i = 0; i < children.length; i++) {
        const hoverRectangle = children[i] as HTMLElement
        if (i >= rects.length) {
            hoverRectangle.classList.add("hide")
            continue
        }

        hoverRectangle.className = "hover-rectangle" // remove all other classes
        const rect = rects[i]
        AddStateClassFromState(hoverRectangle, state)
        hoverRectangle.style.width = rect.width + "px"
        hoverRectangle.style.height = rect.height + "px"
        hoverRectangle.style.top = rect.top - parentRect.top + "px"
        hoverRectangle.style.left = rect.left - parentRect.left + "px"
    }
    return state
}

export function AddStateClass(el: HTMLElement, vocab: JpdbVocabulary) {
    const state = getVocabState(vocab, { trimKana: true })
    AddStateClassFromState(el, state)
}
function AddStateClassFromState(el: HTMLElement, state: VocabState) {
    if (state === VocabState.Known)
        el.classList.add("known")
    else if (state === VocabState.Similar || state === VocabState.AltSpelling)
        el.classList.add("similar")
    else if (state !== VocabState.New)
        el.classList.add("ignore")
}
