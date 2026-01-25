import { Children } from "../framework/createElement";
import { getAnkiWordsTrimKanaMapSync, getAnkiWordsSetSync, getAnkiWordsSync } from "../pages/anki/CardList";
import { UnicodeCharacterType, unicodeType } from "../utils/AnkiUtil";
import { Subtitles } from "../utils/srt";
import { isIgnoredSync } from "./IgnoreList";
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
    Ignored
}

export function TrimKana(s: string) {
    let firstKanji = -1;
    let lastKanji = -1;
    for (let i = 0; i < s.length; i++) {
        const state = unicodeType(s, i)
        if (state === UnicodeCharacterType.Kanji) {
            if (firstKanji === -1) firstKanji = i
            lastKanji = i
        }
    }
    if (firstKanji === -1) return ""
    return s.substring(firstKanji, lastKanji + 1)
}

// somewhat expensive (profiler says otherwise though)
export function getVocabState(vocab: JpdbVocabulary, config: VocabStateConfig = {}): VocabState {
    return getVocabStateAndNote(vocab, config)[0]
}
// ideally I think this would return a more complex state since multiple states often apply
// this is mainly relevant for the ignored state, we basically want to reorder the priority sometimes
export function getVocabStateAndNote(vocab: JpdbVocabulary, config: VocabStateConfig = {}): [VocabState, string | undefined] {
    const { skipIgnoreCheck, trimKana } = config

    const knownWords = getAnkiWordsSync()
    const knownWordsSet = getAnkiWordsSetSync()
    const word = vocab[0]
    if (vocab && knownWordsSet) {
        if (knownWordsSet.has(word))
            return [VocabState.Known, undefined]
        for (const spelling of vocab[6])
            if (knownWordsSet.has(spelling))
                return [VocabState.AltSpelling, spelling]
    }
    if (!skipIgnoreCheck && isIgnoredSync(vocab[5])) return [VocabState.Ignored, undefined]
    if (vocab[4].includes("prt"))
        return [VocabState.Particle, undefined]
    let kanji = false
    for (let i = 0; i < word.length; i++) {
        const unicode = unicodeType(word, i)
        if (unicode === UnicodeCharacterType.Kanji)
            kanji = true;
    }
    // TODO these can still be valuable
    // stop filtering once we set up good ignoring
    if (!kanji) return [VocabState.Kana, undefined]
    if (knownWords) {
        const startsWithKanji = unicodeType(word[0]) === UnicodeCharacterType.Kanji
        const endsWithKanji = unicodeType(word[word.length - 1]) === UnicodeCharacterType.Kanji
        const start = word.substring(0, word.length - 1)
        const end = word.substring(1, word.length)
        for (const knownWord of knownWords) {
            if (knownWord.length > 0) {
                if (knownWord.length === word.length - 1) {
                    if (!endsWithKanji && word.startsWith(knownWord))
                        return [VocabState.Similar, knownWord]
                    if (!startsWithKanji && word.endsWith(knownWord))
                        return [VocabState.Similar, knownWord]
                } else if (knownWord.length === word.length) {
                    if (!endsWithKanji && knownWord.startsWith(start) &&
                        unicodeType(knownWord[knownWord.length - 1]) !== UnicodeCharacterType.Kanji)
                        return [VocabState.Similar, knownWord]
                    if (!startsWithKanji && knownWord.endsWith(end) &&
                        unicodeType(knownWord[0]) !== UnicodeCharacterType.Kanji)
                        return [VocabState.Similar, knownWord]
                }
            }
        }
    }
    if (trimKana) {
        const ankiTrimmedKana = getAnkiWordsTrimKanaMapSync()
        if (ankiTrimmedKana) {
            const trimmed = TrimKana(word)
            const found = ankiTrimmedKana.get(trimmed)
            if (found) {
                return [VocabState.Similar, found]
            }
        }
    }
    return [VocabState.New, undefined]
}


export function getN1Tokens(subtitles: Subtitles, jpdb: JpdbParseResponse, config: VocabStateConfig) {
    const { kanaUnknown } = config
    const res = new Map<number, number[]>()
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
            if (existing) existing.push(unknown[0])
            else res.set(vid, [unknown[0]])
        }
    }
    return res
}