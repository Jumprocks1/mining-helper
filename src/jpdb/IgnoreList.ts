type IgnoreList = number[] // vid from jpdb

let localIgnoreList: IgnoreList | undefined
let localIgnoreSet: Set<number> | undefined

export async function loadIgnoreList(disableCache = false) {
    if (!disableCache && localIgnoreList) return localIgnoreList
    localIgnoreList = (await chrome.storage.local.get({ ignoreList: [] })).ignoreList
    return localIgnoreList!
}

export async function IgnoreVid(vid: number) {
    const list = await loadIgnoreList(true)
    if (!list.includes(vid)) {
        list.push(vid)
        await chrome.storage.local.set({ ignoreList: list })
    }
    if (localIgnoreSet) localIgnoreSet.add(vid)
}

function getIgnoreSetSync() {
    if (!localIgnoreList) return
    return localIgnoreSet ??= new Set(localIgnoreList)
}

export function isIgnoredSync(vid: number) {
    const set = getIgnoreSetSync()
    if (!set) return
    return set.has(vid)
}