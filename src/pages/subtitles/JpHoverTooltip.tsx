import { JsPopover } from "../../components/basic/JsPopover";
import { Children } from "../../framework/createElement";
import { JpdbToken, JpdbVocabulary } from "../../jpdb/JpdbParseText";
import { getVocabStateAndNote, VocabState } from "../../jpdb/JpdbState";
import AnkiConnect from "../../utils/AnkiConnect";
import { furiFromToken, furiToRuby } from "../../utils/util";

export default class JpHoverTooltip extends JsPopover {

    constructor(anchor?: HTMLElement) {
        super({
            anchor,
            id: "jp-hover-tooltip",
            type: "js-tooltip"
        })
    }

    Target(target: HTMLElement, vocab: JpdbVocabulary, token: JpdbToken) {
        this.Anchor = target
        this.TargetBase(vocab, token)
        this.Node.style.left = `anchor(left)`
        this.Node.style.top = `anchor(bottom)`
    }

    private TargetBase(vocab: JpdbVocabulary, token: JpdbToken) {
        const [vocabState, vocabNote] = getVocabStateAndNote(vocab, { trimKana: true })

        const vocabStateString = VocabState[vocabState].toLowerCase()
        let vocabStateNode: Children = vocabStateString
        if (vocabState === VocabState.AltSpelling || vocabState === VocabState.Known || vocabState === VocabState.Similar) {
            const target = vocabState === VocabState.Known ? vocab[0] : vocabNote
            if (target) {
                vocabStateNode = <button className="link-button uncolored"
                    onclick={() => AnkiConnect.call("guiBrowse", { query: `word:${target}` })}>
                    {vocabStateString}
                </button>
            }
        }

        const ruby = furiToRuby(furiFromToken(vocab[0], token))

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

    TargetRect(hoverRect: DOMRect, vocab: JpdbVocabulary, token: JpdbToken) {
        if (!this.Anchor) return
        this.TargetBase(vocab, token)
        const parentRect = this.Anchor.getBoundingClientRect()
        const x = hoverRect.left - parentRect.left
        const y = hoverRect.bottom - parentRect.top
        this.Node.style.left = `calc(anchor(left) + ${x}px)`
        this.Node.style.top = `calc(anchor(top) + ${y}px)`
    }
}