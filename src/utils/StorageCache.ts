import { BrowserStorage } from "./BrowserApi"

interface Props {
    prefix: string
    maxEntries: number
    minimumAvailableBytes?: number
}

interface CacheInfo {
    key: string | number // excludes prefix since it's stored in cacheInfoKey
    time: number
}

export default class StorageCache {
    readonly Prefix: string
    readonly InfoKey: string
    readonly Props: Props


    constructor(props: Props) {
        this.Props = props;
        this.Prefix = props.prefix
        this.InfoKey = this.Prefix + "cacheInfo"
    }

    async Clear() {
        const keys = await BrowserStorage.local.getKeys()
        for (const key of keys) {
            if (key.startsWith(this.Prefix)) {
                await BrowserStorage.local.remove(key)
            }
        }
    }


    async CleanNoSave() {
        const quota = BrowserStorage.local.QUOTA_BYTES
        const cacheInfo = (await BrowserStorage.local.get({ [this.InfoKey]: [] }))[this.InfoKey] as CacheInfo[]
        cacheInfo.sort((a, b) => b.time - a.time)
        const minimumAvailable = this.Props.minimumAvailableBytes ?? 1_000_000 // 1 MB spare
        const maxEntries = this.Props.maxEntries
        const getBytes = BrowserStorage.local.getBytesInUse?.bind(BrowserStorage.local) ?? (() => 0)
        while ((quota - await getBytes()) < minimumAvailable || cacheInfo.length > maxEntries) {
            const pop = cacheInfo.pop()
            if (!pop) break
            await BrowserStorage.local.remove(this.Prefix + pop.key)
        }
        return cacheInfo
    }

    async Store(key: string | number, value: any) {
        const cacheInfo = await this.CleanNoSave()
        let found = false
        for (let i = 0; i < cacheInfo.length; i++) {
            if (cacheInfo[i].key === key) {
                cacheInfo[i].time = Date.now()
                found = true
            }
        }
        if (!found) cacheInfo.push({ key, time: Date.now() })
        await BrowserStorage.local.set({ [this.Prefix + key]: value, [this.InfoKey]: cacheInfo })
    }

    async Get<T>(key: string | number, get: () => Promise<T>, forceRefresh?: boolean): Promise<T>;
    async Get<T>(key: string | number, get?: () => Promise<T>, forceRefresh?: boolean): Promise<T | undefined>;
    async Get<T>(key: string | number, get?: () => Promise<T>, forceRefresh?: boolean): Promise<T | undefined> {
        const cacheKey = this.Prefix + key
        if (forceRefresh) {
            if (!get) throw new Error()
            const value = await get()
            // not awaiting this can technically lead to some bad behavior,
            //   spamming the cache can still result in 2 request if it's sent during this.Store
            // not relevant with local storage, so going to leave it for now
            this.Store(key, value)
            return value
        }
        const found = (await BrowserStorage.local.get(cacheKey))[cacheKey] as T | undefined
        if (!found) {
            if (get === undefined) return undefined
            const value = await get()
            this.Store(key, value) // not awaited
            return value
        } else {
            return found
        }
    }
}