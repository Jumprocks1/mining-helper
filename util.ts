let apiKey: string | undefined = undefined

async function getApiKey() {
    // TODO need better way of settings
    // for now, run chrome.storage.local.set({apiKey:"XXX"})
    apiKey = (await chrome.storage.local.get({ apiKey: undefined })).apiKey
}

export async function lookupFuri(card: CardData) {
    if (!apiKey) await getApiKey()
    const s = card.jpSentenceKanji
    const res = await fetch("https://jpdb.io/api/v1/parse", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            text: s,
            token_fields: [
                "position",
                "length",
                "furigana"
            ],
            position_length_encoding: "utf16"
        })
    })
    const json = await res.json()
    // TODO we could get the furi for the kanji, but for now that will come from jpdb mining
    // const targetLeft = card.jpSentenceKanji.indexOf(card.kanji)
    // const targetRight = targetLeft + card.kanji.length
    let wordFuri = ""
    let o = ""
    for (const token of json.tokens) {
        const [position, length, furi] = token
        const left = position
        const right = position + length
        if (furi === null) {
            o += s.substring(position, position + length)
        }
        else {
            for (const part of furi) {
                if (!Array.isArray(part)) {
                    o += part
                } else {
                    if (o.length > 0) {
                        const prev = o[o.length - 1]
                        if (prev !== "]" && prev !== ">")
                            o += " "
                    }
                    o += `${part[0]}[${part[1]}]`
                }
            }
        }
    }
    card.jpSentenceFuri = o
    if (!card.furigana) card.furigana = wordFuri
}