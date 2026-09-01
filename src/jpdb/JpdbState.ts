import { getAnkiFuriganaSetSync, getAnkiFuriganaTrimmedMapSync } from "../pages/anki/CardList";
import { UnicodeCharacterType, unicodeType } from "../utils/AnkiUtil";
import { Subtitles } from "../utils/srt";
import { getIgnoredStateSync } from "./IgnoreList";
import { JpdbParseResponse, JpdbToken, JpdbVocabulary } from "./JpdbParseText";

export interface VocabStateConfig {
    skipIgnoreCheck?: boolean
    trimKana?: boolean
    kanaUnknown?: boolean
}


export enum VocabState {
    New,
    Known,
    Particle,
    Kana,
    Similar,
    AltSpelling,
    Ignored,
    TemporarilyIgnored
}
type FuriganaRemove = (pendingBase: string, pendingRead: string) => boolean

// this collects the entire kanji + reading and applies them as a whole
// this is really bad for viewing/reading, but good for matching/diffing
export function simplifiedFurigana(furi: string, remove?: FuriganaRemove) {
    if (!furi) return furi
    let [base, reading] = furiBaseAndReading(furi, remove)
    return `${base}[${reading}]`
}

export function furiBaseAndReading(furi: string, remove?: FuriganaRemove): [base: string, reading: string] {
    let base = ""
    let pendingBase = ""
    let pendingReading = ""
    let reading = ""
    let insideReading = false
    function pushPending() {
        if (pendingBase) {
            if (insideReading) {
                if (!remove?.(pendingBase, pendingReading)) {
                    base += pendingBase
                    reading += pendingReading
                }
            } else {
                // if no reading listed, add to both
                base += pendingBase
                reading += pendingBase
            }
        }
        pendingBase = ""
        pendingReading = ""
        insideReading = false
    }
    for (let i = 0; i < furi.length; i++) {
        const c = furi[i]
        if (c === "[") insideReading = true
        else if (c === "]" || c === " ") pushPending()
        else if (insideReading) pendingReading += c
        else pendingBase += c
    }
    pushPending()
    return [base, reading]
}

// Ideally only returns the relvant part of a furigana
// should trim kana from the word + reading
export function furiganaTrimmed(furi: string) {
    let [base, reading] = furiBaseAndReading(furi)
    let i = 0;
    while (i < base.length && i < reading.length && base[i] === reading[i]) i += 1
    let j = 0;
    while (j < base.length && j < reading.length && base[base.length - j - 1] === reading[reading.length - j - 1]) j += 1
    if (i + j >= base.length) return ""
    base = base.substring(i, base.length - j)
    reading = reading.substring(i, reading.length - j)
    // return base // returning just the base for this is similar to our old logic
    return `${base}[${reading}]`
}

// somewhat expensive (profiler says otherwise though)
export function getVocabState(vocab: JpdbVocabulary, config: VocabStateConfig = {}): VocabState {
    return getVocabStateAndNote(vocab, config)[0]
}
// ideally I think this would return a more complex state since multiple states often apply
// this is mainly relevant for the ignored state, we basically want to reorder the priority sometimes
export function getVocabStateAndNote(vocab: JpdbVocabulary, config: VocabStateConfig = {}): [VocabState, string | undefined] {
    const { skipIgnoreCheck, trimKana } = config

    const knownFuriganaSet = getAnkiFuriganaSetSync()
    const word = vocab[0]
    const furigana = vocab.furigana
    if (!furigana) throw `Missing furigana for ${vocab[0]}`

    if (vocab && knownFuriganaSet) {
        const [base, reading] = furiBaseAndReading(furigana)
        if (knownFuriganaSet.has(`${base}[${reading}]`))
            return [VocabState.Known, base]
        // Note this is not applied to the Anki cards in the known set
        const [numberTrimBase, numberTrimReading] = furiBaseAndReading(furigana, b => b.length === 1 && unicodeType(b) === UnicodeCharacterType.Number)
        if (numberTrimBase !== base && knownFuriganaSet.has(`${numberTrimBase}[${numberTrimReading}]`))
            return [VocabState.Known, numberTrimBase]
        const altSpelling = vocab[6]
        if (altSpelling && altSpelling.length > 0) {
            // The below code works pretty well as far as matching our old behavior
            // I haven't yet found this behavior desirable though, so will probably leave it disabled
            // for (const spelling of vocab[6]) {
            //     for (const e of knownFuriganaSet) {
            //         if (furiBaseAndReading(e)[0] === spelling)
            //             return [VocabState.AltSpelling, spelling]
            //     }
            // }
        }
    }
    if (!skipIgnoreCheck) {
        const ignoredState = getIgnoredStateSync(vocab[5])
        if (ignoredState) return [ignoredState, undefined]
    }
    if (vocab[4].includes("prt"))
        return [VocabState.Particle, undefined]
    let kanji = false
    for (let i = 0; i < word.length; i++) {
        const unicode = unicodeType(word, i)
        if (unicode === UnicodeCharacterType.Kanji)
            kanji = true;
    }
    // TODO kana vocab is fine as long as it's past a certain frequency
    if (!kanji) return [VocabState.Kana, undefined]
    if (trimKana) {
        const ankiFuriTrim = getAnkiFuriganaTrimmedMapSync()
        if (ankiFuriTrim) {
            const found = ankiFuriTrim.get(furiganaTrimmed(furigana))
            if (found) return [VocabState.Similar, furiBaseAndReading(found)[0]]
        }
    }
    return [VocabState.New, undefined]
}


export function geti1Tokens(subtitles: Subtitles, jpdb: JpdbParseResponse, config: VocabStateConfig) {
    const { kanaUnknown } = config
    const res = new Map<number, JpdbToken[]>()
    for (const entry of subtitles.processedEntries) {
        let unknown: JpdbToken | undefined
        const end = entry.characterOffset + entry.text.length
        let tokenCount = 0
        for (const token of jpdb.tokens) {
            if (token[0] >= entry.characterOffset && token[0] < end) {
                tokenCount += 1
                const state = getVocabState(jpdb.vocabulary[token[3]], config)
                if (state === VocabState.New || (kanaUnknown && state === VocabState.Kana)) {
                    if (unknown === undefined) {
                        unknown = token
                    } else {
                        unknown = undefined
                        break
                    }
                }
            }
        }
        // ignore entries with <3 tokens
        if (unknown !== undefined && tokenCount >= 3) {
            const vid = jpdb.vocabulary[unknown[3]][5]
            const existing = res.get(vid)
            if (existing) existing.push(unknown)
            else res.set(vid, [unknown])
        }
    }
    return res
}