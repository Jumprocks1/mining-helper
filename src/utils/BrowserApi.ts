// meant to make things run smoothly across Chrome ext/FF ext/web

type GetMethod = {
    <T extends Record<string, any>>(t: T): Promise<T>;
    <T extends string>(key: T): Promise<Record<T, unknown>>;
    (): Promise<Record<string, any>>;
}


interface SingleStorage {
    get: GetMethod
    set: <T extends Record<string, any>>(t: T) => Promise<void>;
    getKeys: () => Promise<string[]>
    remove: (key: string) => Promise<void>
    getBytesInUse?: () => Promise<number>
    QUOTA_BYTES: number
}

interface StorageApi {
    local: SingleStorage
    session: SingleStorage
}

interface BrowserApiI {
    storage: StorageApi
}


function getStorageApi(): StorageApi {
    if (typeof browser !== "undefined") return browser.storage
    // @ts-expect-error
    if (typeof chrome !== "undefined" && chrome.storage) return chrome.storage

    const localPrefix = "storage.local_"
    const sessionPrefix = "storage.session_"

    const makeStorage = (storage: Storage, prefix: string): SingleStorage => ({
        get: async (request?: Record<string, any>) => {
            if (request === undefined) {
                const o: Record<string, any> = {}
                for (let i = 0; i < storage.length; i++) {
                    const key = storage.key(i)
                    if (key?.startsWith(prefix)) {
                        const value = storage.getItem(key)
                        if (value !== null) {
                            try {
                                o[key.substring(prefix.length)] = JSON.parse(value)
                            } catch (e) {
                                console.error(e, {
                                    message: "Failed to parse",
                                    key,
                                    value,
                                })
                            }
                        }
                    }
                }
                return o
            }
            for (const key in request) {
                const value = storage.getItem(prefix + key)
                if (value !== null) {
                    try {
                        // TODO this probably gets borked for some weird Array/binary values (even though they work with chrome storage)
                        request[key] = JSON.parse(value)
                    } catch (e) {
                        console.error(e, {
                            message: "Failed to parse",
                            key,
                            value,
                        })
                    }
                }
            }
            return request
        },
        set: async request => {
            for (const key in request) {
                storage.setItem(prefix + key, JSON.stringify(request[key]))
            }
        },
        getKeys: async () => {
            const o: string[] = []
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i)
                if (key?.startsWith(prefix)) {
                    o.push(key.substring(prefix.length))
                }
            }
            return o
        },
        remove: async (key: string) => {
            storage.removeItem(prefix + key)
        },
        getBytesInUse: async () => {
            let o = 0;
            for (let i = 0; i < storage.length; i++) {
                const key = storage.key(i)!;
                // blob since a JP character takes more than 1 byte
                o += new Blob([key, storage.getItem(key)!]).size
            }
            return o;
        },
        QUOTA_BYTES: 1_000_000_000 * 5 // 5 MB seems to be a good amount
    })

    return {
        local: makeStorage(localStorage, localPrefix),
        session: makeStorage(sessionStorage, sessionPrefix)
    }
}

const BrowserApi: BrowserApiI = {
    storage: getStorageApi()
}

export default BrowserApi;

export const BrowserStorage = BrowserApi.storage