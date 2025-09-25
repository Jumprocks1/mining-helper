/// <reference path="types.d.ts" />
// @ts-nocheck

const originalFetch = fetch;
const fetches = {}
window.fetch = (...args) => {
    const input = args[0]
    const res1 = originalFetch.apply(window, args)
    const prefix = "/static/v/"
    if (typeof input === "string" && input.startsWith(prefix)) {
        const audio = input.substring(prefix.length)
        // console.log(`fetch ${audio}`)
        const originalThen1 = res1.then
        res1.then = (...args1) => {
            const res2 = originalThen1.apply(res1, args1)
            const originalThen2 = res2.then
            res2.then = (...args2) => fetches[audio] = originalThen2.apply(res2, args2)
            return res2
        }
    }
    return res1
}

document.addEventListener("fetch-audio", async ev => {
    const audios = ev.detail.audios
    preload_audio(audios);
    const fetchedAudios = []
    for (const e of audios) {
        fetchedAudios.push({ name: e, data: (await fetches[e])[0] })
    }
    if (fetchedAudios.length > 0) {
        document.dispatchEvent(new CustomEvent("fetch-audio-response", {
            detail: { audios: fetchedAudios, requestId: ev.detail.requestId }
        }))
    }
})