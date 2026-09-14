export default class BrowserCache {
    CachePromise?: Promise<Cache>
    Cache?: Cache
    readonly Name: string
    constructor(name: string) {
        this.Name = name
    }

    async Clear() {
        const cache = (this.Cache ??= (await (this.CachePromise ??= caches.open(this.Name))))
        for (const key of await cache.keys()) {
            await cache.delete(key)
        }
    }

    // TODO add a background based clean here
    // No need to await it, but it would keep track if it's already been started to prevent multiple runs

    async GetJson<T>(key: string, get: () => Promise<T>, forceRefresh?: boolean): Promise<T>;
    async GetJson<T>(key: string, get?: () => Promise<T>, forceRefresh?: boolean): Promise<T | undefined>;
    async GetJson<T>(key: string, get?: () => Promise<T>, forceRefresh?: boolean): Promise<T | undefined> {
        const cache = (this.Cache ??= (await (this.CachePromise ??= caches.open(this.Name))))
        const cacheKey = `https://jumprocks1.github.io/_/cache/${key}`
        if (forceRefresh) {
            if (!get) throw new Error()
            const value = await get()
            const s = JSON.stringify(value)
            const response = new Response(s, {
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": s.length.toString()
                }
            })
            await cache.put(cacheKey, response)
            return value
        }
        const found = await cache.match(cacheKey)
        if (!found) {
            if (get === undefined) return undefined
            const value = await get()
            const s = JSON.stringify(value)
            const response = new Response(s, {
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": s.length.toString()
                }
            })
            await cache.put(cacheKey, response)
            return value
        } else {
            return found.json()
        }
    }
}