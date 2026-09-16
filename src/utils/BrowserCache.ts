export default class BrowserCache {
    CachePromise?: Promise<Cache>
    Cache?: Cache
    readonly MaxEntries: number
    readonly MaxUsage: number
    readonly Name: string
    constructor(name: string, maxUsage: number, maxEntries: number) {
        this.MaxEntries = maxEntries
        this.MaxUsage = maxUsage
        this.Name = name
    }

    async Clear() {
        const cache = (this.Cache ??= (await (this.CachePromise ??= caches.open(this.Name))))
        for (const key of await cache.keys()) {
            await cache.delete(key)
        }
    }

    Cleaned = false
    async Clean() {
        // Only allow 1 clean per page load
        if (this.Cleaned) return
        this.Cleaned = true
        const cache = (this.Cache ??= (await (this.CachePromise ??= caches.open(this.Name))))
        const keys = await cache.keys()
        const objects: [time: number, length: number, request: Request][] = []
        let bytesInUse = 0
        for (const key of keys) {
            const match = await cache.match(key)
            if (match) {
                const time = parseInt(match.headers.get("date") ?? "0")
                const length = parseInt(match.headers.get("content-length") ?? "0")
                objects.push([time, length, key])
                bytesInUse += length
            }
        }
        objects.sort((a, b) => b[0] - a[0])
        while (bytesInUse > this.MaxUsage || objects.length > this.MaxEntries) {
            const pop = objects.pop()
            if (!pop) break
            await cache.delete(pop[2])
            bytesInUse -= pop[1]
        }
    }

    async GetJson<T>(key: string, get: () => Promise<T>, forceRefresh?: boolean): Promise<T>;
    async GetJson<T>(key: string, get?: () => Promise<T>, forceRefresh?: boolean): Promise<T | undefined>;
    async GetJson<T>(key: string, get?: () => Promise<T>, forceRefresh?: boolean): Promise<T | undefined> {
        const cache = (this.Cache ??= (await (this.CachePromise ??= caches.open(this.Name))))
        const cacheKey = `https://jumprocks1.github.io/_/cache/${key}`
        const getAndStore = async () => {
            if (!get) throw new Error()
            // This will only run on the first uncached get per page load
            const cleanPromise = this.Cleaned ? undefined : this.Clean()
            const value = await get()
            const s = JSON.stringify(value)
            const response = new Response(s, {
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": s.length.toString(),
                    Date: Date.now().toString()
                }
            })
            if (cleanPromise) await cleanPromise // make sure cleaning is done before we save
            await cache.put(cacheKey, response)
            return value
        }
        if (forceRefresh) {
            return getAndStore()
        }
        const found = await cache.match(cacheKey)
        if (!found) {
            if (get === undefined) return undefined
            return getAndStore()
        } else {
            return found.json()
        }
    }
}