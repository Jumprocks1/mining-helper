import { BrowserStorage } from "../utils/BrowserApi"
import { JpdbVocabulary } from "./JpdbParseText"
import { VocabState } from "./JpdbState"

type Entry = { word: string, expire?: number }
type IgnoreList = Entry[]

let localIgnoreList: IgnoreList | undefined
let localIgnoreLookup: Map<string, Entry> | undefined

let checkedForExpire = false

export async function loadIgnoreList(disableCache = false) {
    if (!disableCache && localIgnoreList) return localIgnoreList
    localIgnoreList = (await BrowserStorage.local.get({ ignoreList: [] })).ignoreList
    // only check this once per page load
    if (!checkedForExpire && localIgnoreList) {
        checkedForExpire = true
        const now = Date.now()
        let expired = false
        for (let i = localIgnoreList.length - 1; i >= 0; i--) {
            const e = localIgnoreList[i]
            if (e.expire && e.expire < now) {
                localIgnoreList.splice(i, 1)
                expired = true;
            }
        }
        if (expired) {
            await BrowserStorage.local.set({ ignoreList: localIgnoreList })
        }
    }
    return localIgnoreList!
}

export async function IgnoreVocab(vocab: JpdbVocabulary, temp?: boolean) {
    const list = await loadIgnoreList(true)
    const state = getIgnoredStateSync(vocab)
    if (state !== false) return

    const word = vocab[0]
    const obj: Entry = { word }
    // TODO could also allow only ignoring for a specific source for even longer
    if (temp) obj.expire = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
    list.push(obj)
    await BrowserStorage.local.set({ ignoreList: list })
    if (localIgnoreLookup) localIgnoreLookup.set(word, obj)
}

export async function UnIgnoreVocab(vocab: JpdbVocabulary) {
    const word = vocab[0]
    const list = await loadIgnoreList(true)
    const index = list.findIndex(e => e.word === word)
    if (index >= 0) {
        list.splice(index, 1)
        await BrowserStorage.local.set({ ignoreList: list })
        if (localIgnoreLookup) localIgnoreLookup.delete(word)
    }
}

function getIgnoreLookupSync() {
    if (!localIgnoreList) return
    if (localIgnoreLookup) return localIgnoreLookup
    const lookup = new Map<string, Entry>()
    for (const e of localIgnoreList) {
        if (e.word) lookup.set(e.word, e)
    }
    return localIgnoreLookup = lookup
}

export function getIgnoredStateSync(vocab: JpdbVocabulary): VocabState | false {
    const word = vocab[0]
    const lookup = getIgnoreLookupSync()
    if (!lookup) throw Error("Ignore list not loaded")
    const ignored = lookup.get(word)
    if (ignored === undefined) return false
    return ignored.expire ? VocabState.TemporarilyIgnored : VocabState.Ignored
}