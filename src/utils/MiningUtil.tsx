import { CardData } from "./util"

export async function getOrCreatePendingCard(word: string, checkPartial: boolean) {
    word = word.trim()

    if (checkPartial) {
        const keys = await chrome.storage.session.getKeys()
        const foundKey = keys.find(e => e.includes(word))
        if (foundKey) word = foundKey
    }

    const res = await chrome.storage.session.get({ [word]: {} })
    const card: CardData = res[word]
    card.kanji = word

    return card
}

export async function mutatePendingCard(word: string, checkPartial: boolean, mutate: (card: CardData) => Promise<void>) {
    const card = await getOrCreatePendingCard(word, checkPartial)
    card.modified = Date.now()
    await mutate(card)
    await saveCard(card)
}

export async function saveCard(card: CardData) {
    chrome.storage.session.set({ [card.kanji]: card })
}