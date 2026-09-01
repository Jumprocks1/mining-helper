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

    Target(target: HTMLElement, vocab: JpdbVocabulary) {
        if (!vocab.furigana) this.Close()
        this.Anchor = target
        this.TargetBase(vocab)
        this.Node.style.left = `anchor(left)`
        this.Node.style.top = `anchor(bottom)`
    }

    private TargetBase(vocab: JpdbVocabulary) {
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

    TargetRect(hoverRect: DOMRect, vocab: JpdbVocabulary) {
        if (!this.Anchor) return
        this.TargetBase(vocab)
        const parentRect = this.Anchor.getBoundingClientRect()
        const x = hoverRect.left - parentRect.left
        const y = hoverRect.bottom - parentRect.top
        this.Node.style.left = `calc(anchor(left) + ${x}px)`
        this.Node.style.top = `calc(anchor(top) + ${y}px)`
    }
}



// TODO would love to share this with SubtitleViewer
// Not quite as simple as I wanted since SubtitleViewer also relies on the hover state for underlining
// We'll need to change loadedTooltip to also work for returning the currently hovered characters (even if there's no tooltip present)

interface TooltipHandler {
    body: HTMLElement,
    getTargetAndVocab: (node: Node) => [HTMLElement, JpdbVocabulary] | undefined,
    invert: boolean
}
const kanjiTooltipHandlers: TooltipHandler[] = []
let globalHandlerRegistered = false
let loadedTooltip: {
    vocab: JpdbVocabulary,
    handler: TooltipHandler
} | undefined
let popover: JpHoverTooltip | undefined // this can end up set but with open false
let mouseX: number | undefined
let mouseY: number | undefined

function mousemove(ev: MouseEvent) {
    mouseX = ev.clientX
    mouseY = ev.clientY
    if (loadedTooltip) {
        const showPopover = ev.shiftKey !== loadedTooltip.handler.invert
        if (popover && !showPopover) {
            if (popover.Node.contains(ev.target as HTMLElement)) return
        }
    }
    UpdateHoverInfo(ev.shiftKey)
}
function keydown(ev: KeyboardEvent) {
    if (loadedTooltip) {
        const showPopover = ev.shiftKey !== loadedTooltip.handler.invert
        if (!showPopover) return
    }
    UpdateHoverInfo(ev.shiftKey)
}

function close(shiftKey: boolean) {
    if (!loadedTooltip) return
    loadedTooltip = undefined
    popover?.Close()
    // we immediately call this since `Close` can cause a new character to become hovered
    // have to be careful for infinite loops
    UpdateHoverInfo(shiftKey)
}
function UpdateHoverInfo(shiftKey: boolean) {
    for (const handler of kanjiTooltipHandlers) {
        // TODO this repeats the getHoveredCharacterIndex
        UpdateHoverInfoSingle(handler, shiftKey)
    }
}
function UpdateHoverInfoSingle(handler: TooltipHandler, shiftKey: boolean) {
    // Only call this method after confirming the event target isn't inside the popover already
    if (mouseX === undefined || mouseY === undefined) return
    // We use this instead of the mouse target so it works with keyboard I think
    // There might be other reasons too, like if there's multiple text nodes in one target
    const showPopover = shiftKey !== handler.invert
    if (!showPopover && !loadedTooltip) return
    const res = getHoveredCharacterIndex(mouseX, mouseY)
    if (!res) return close(shiftKey)
    const targetAndVocab = handler.getTargetAndVocab(res[0])
    if (!targetAndVocab) return close(shiftKey)
    const [target, vocab] = targetAndVocab
    // if we're hovering the open target for the current popover, we don't care if we're holding shift or not
    if (loadedTooltip?.vocab === vocab) return
    // if we're hovering a different vocab and we don't want to show a popover, we have to close this one
    if (!showPopover) return close(shiftKey)
    loadedTooltip = { vocab, handler }
    popover ??= new JpHoverTooltip()
    popover.Target(target, vocab)
}

// can safely modify invert in handler object
export function RegisterJpHoverTooltip(handler: TooltipHandler) {
    if (!globalHandlerRegistered) {
        globalHandlerRegistered = true
        document.addEventListener("mousemove", mousemove)
        document.addEventListener("keydown", keydown)
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
