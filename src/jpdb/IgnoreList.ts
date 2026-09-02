import { BrowserStorage } from "../utils/BrowserApi"
import { VocabState } from "./JpdbState"

type Entry = number | { vid: number, word?: string, expire?: number }
type IgnoreList = Entry[] // vid from jpdb

let localIgnoreList: IgnoreList | undefined
let localIgnoreLookup: Map<number, Entry> | undefined

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
            if (typeof e !== "number" && e.expire && e.expire < now) {
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

export async function IgnoreVid(vid: number, word?: string, temp?: boolean) {
    const list = await loadIgnoreList(true)
    const alreadyExists = list.some(e => typeof e === "number" ? e === vid : e.vid === vid)
    if (!alreadyExists) {
        let obj: Entry = vid
        if (word || temp) {
            obj = { vid }
            if (word) obj.word = word
            // TODO could also allow only ignoring for a specific source for even longer
            if (temp) obj.expire = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
        }
        list.push(obj)
        await BrowserStorage.local.set({ ignoreList: list })
        if (localIgnoreLookup) localIgnoreLookup.set(vid, obj)
    }
}

export async function UnIgnoreVid(vid: number) {
    const list = await loadIgnoreList(true)
    const index = list.findIndex(e => typeof e === "number" ? e === vid : e.vid === vid)
    if (index >= 0) {
        list.splice(index, 1)
        await BrowserStorage.local.set({ ignoreList: list })
        if (localIgnoreLookup) localIgnoreLookup.delete(vid)
    }
}

function getIgnoreLookupSync() {
    if (!localIgnoreList) return
    if (localIgnoreLookup) return localIgnoreLookup
    const lookup = new Map<number, Entry>()
    for (const e of localIgnoreList) {
        if (typeof e === "number") lookup.set(e, e)
        else lookup.set(e.vid, e)
    }
    return lookup
}

export function getIgnoredStateSync(vid: number): VocabState | false {
    const lookup = getIgnoreLookupSync()
    if (!lookup) throw Error("Ignore list not loaded")
    const ignored = lookup.get(vid)
    if (!ignored) return false
    if (typeof ignored === "number") return VocabState.Ignored
    return ignored.expire ? VocabState.TemporarilyIgnored : VocabState.Ignored
}