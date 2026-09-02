import { BrowserStorage } from "./BrowserApi"
import { CardData } from "./util"

export async function getOrCreatePendingCard(word: string, checkPartial: boolean) {
    word = word.trim()

    if (checkPartial) {
        const keys = await BrowserStorage.session.getKeys()
        const foundKey = keys.find(e => e.includes(word))
        if (foundKey) word = foundKey
    }

    const res = await BrowserStorage.session.get({ [word]: {} })
    const card = res[word] as CardData
    card.kanji = word

    return card
}

export async function mutatePendingCard(word: string, checkPartial: boolean, mutate: (card: CardData) => Promise<void> | void) {
    const card = await getOrCreatePendingCard(word, checkPartial)
    card.modified = Date.now()
    await mutate(card)
    await saveCard(card)
}

export async function saveCard(card: CardData) {
    BrowserStorage.session.set({ [card.kanji]: card })
}