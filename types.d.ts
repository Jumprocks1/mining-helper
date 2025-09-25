export { }

declare global {
    var zip: typeof import("./zip-js")

    interface CardData {
        audioLocalFile: string
        sentenceAudioLocalFile: string
        meaning: string
        kanji: string
        furigana: string
        jpSentenceKanji: string
        jpSentenceFuri: string
        enSentence: string
        audioBytes: ArrayBuffer
        sentenceAudioBytes: ArrayBuffer
    }
}
