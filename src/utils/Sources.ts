import { homeUrl } from "../framework/Router"

export async function fetchSource(name: string) {
    const url = `${homeUrl()}/sources/${name}`
    const res = await fetch(url)
    if (!res.ok || !res.body) throw `Failed to fetch ${name}`
    return res.body
}