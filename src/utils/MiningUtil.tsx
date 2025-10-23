import { CardData } from "./util"

export async function getOrCreatePendingCard(word: string) {
    const res = await chrome.storage.session.get({ [word]: {} })
    const card: CardData = res[word]
    card.kanji = word

    return card
}

export async function mutatePendingCard(word: string, mutate: (card: CardData) => Promise<void>) {
    const card = await getOrCreatePendingCard(word)
    card.modified = Date.now()
    await mutate(card)
    await saveCard(card)
}

export async function saveCard(card: CardData) {
    chrome.storage.session.set({ [card.kanji]: card })
}