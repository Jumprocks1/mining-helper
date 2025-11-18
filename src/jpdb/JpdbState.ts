import { getAnkiWordsSetSync, getAnkiWordsSync, UnicodeCharacterType, unicodeType } from "../anki/CardList";
import { isIgnoredSync } from "./IgnoreList";
import { JpdbVocabulary } from "./JpdbParseText";


export enum VocabState {
    New,
    Known,
    Particle,
    Kana,
    Similar,
    AltSpelling,
    Ignored
}

// somewhat expensive (profiler says otherwise though)
export function getVocabState(vocab: JpdbVocabulary): VocabState {
    return getVocabStateAndNote(vocab)[0]
}
export function getVocabStateAndNote(vocab: JpdbVocabulary, skipIgnoreCheck = false): [VocabState, any] {
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
        const unicode = unicodeType(word[i])
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
    return [VocabState.New, undefined]
}
