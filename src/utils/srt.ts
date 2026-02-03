import { JpdbParseResponse } from "../jpdb/JpdbParseText"
import { parseAss } from "./parseAss"
import StorageCache from "./StorageCache"

export interface SubtitleEntry {
    id?: number
    // index in originalEntries only
    // does not necessarily match processedEntries
    originalIndex: number
    startTime: number // milliseconds
    endTime: number
    text: string
    translation?: string
    node?: HTMLElement
}

export interface SubtitleEntryWithCharacterOffset extends SubtitleEntry {
    // 1 per previous character + 1 for \n between entries
    // maps to jpdb indexes
    characterOffset: number
}

export interface Subtitles {
    offset?: number
    originalEntries: SubtitleEntry[]
    processedEntries: SubtitleEntryWithCharacterOffset[]
    source: "srt" | "ass" | "plain"
    language?: "eng" | "jp"
    name?: string
    hash?: number
    jpdbParse?: JpdbParseResponse
    translated?: Subtitles
}

// https://stackoverflow.com/a/7616484/11435204
export function hash(s: string) {
    let hash = 0;
    for (const char of s) {
        hash = (hash << 5) - hash + char.charCodeAt(0);
        hash |= 0; // Constrain to 32bit integer
    }
    return hash;
}

export function formatTimestamp(timestamp: number, showMs: false | 1 | 2 | 3 = false) {
    let seconds = Math.floor(timestamp / 1000)
    const ms = timestamp - seconds * 1000
    let minutes = Math.floor(seconds / 60)
    seconds -= minutes * 60
    let hours = Math.floor(minutes / 60)
    minutes -= hours * 60
    function f(s: number, p = 2) {
        return s.toString().padStart(p, "0")
    }
    let msS = ""
    if (showMs) msS = "." + f(ms, 3).substring(0, showMs)
    if (hours <= 0) {
        return `${f(minutes)}:${f(seconds)}${msS}`
    } else {
        return `${f(hours)}:${f(minutes)}:${f(seconds)}${msS}`
    }
}

export const OffsetCache = new StorageCache({ prefix: "offset_", maxEntries: 100, minimumAvailableBytes: 500_000 });

export function parseTimestamp(timestamp: string) {
    timestamp = timestamp.replace(".", ",").trim()
    const [hours, minutes, partialSeconds] = timestamp.split(":")
    const [seconds, partialS] = partialSeconds.split(",")
    const milliseconds = parseInt(partialS) * Math.pow(10, 3 - partialS.length)
    return ((parseInt(hours) * 60 + parseInt(minutes)) * 60 + parseInt(seconds)) * 1000 + milliseconds
}

export function parseSubtitles(subtitles: string, filename?: string) {
    if (filename) {
        if (filename.endsWith(".srt")) return parseSrt(subtitles)
        if (filename.endsWith(".ass")) return parseAss(subtitles)
    }
    // should be good enough for now
    const start = subtitles[0]
    if (start >= "0" && start <= "9") {
        return parseSrt(subtitles)
    } else if (start === "[") {
        return parseAss(subtitles)
    } else {
        return parsePlain(subtitles)
    }
}

export function parsePlain(text: string): Subtitles {
    const entries = text.split("\n").map((e, i) => ({
        startTime: i * 1000,
        endTime: i * 1000 + 500,
        originalIndex: i,
        text: e.trim()
    }))
    cleanSubtitleEntries(entries)
    return { source: "plain", originalEntries: entries, processedEntries: [], hash: hash(text) }
}

export async function parseSrt(srt: string): Promise<Subtitles> {
    const entries: SubtitleEntry[] = []
    const o: Subtitles = { source: "srt", originalEntries: entries, processedEntries: [], hash: hash(srt) }

    if (o.hash !== undefined) {
        o.offset = await OffsetCache.Get(o.hash)
    }

    let pendingEntry: Partial<SubtitleEntry> | undefined = undefined

    function closePending() {
        if (pendingEntry) {
            pendingEntry.text = pendingEntry.text?.trim()
            if (pendingEntry.text) entries.push(pendingEntry as SubtitleEntry)
            pendingEntry = undefined
        }
    }

    const lines = srt.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()

        // these few lines feel invalid to me, but .srt for HxH ep 6 had lines that needed this
        // sometimes there are empty subtitle entries with no new line after them, this handles that (sketchily)
        // downside is it would crash if the ~nth subtitle entry was "n"
        // there were also some .srt files with no empty lines, so this was the only way
        if (pendingEntry && pendingEntry.id && parseInt(line) === pendingEntry.id + 1) {
            closePending();
            pendingEntry = { id: parseInt(line) }
            continue;
        }

        if (!pendingEntry) {
            pendingEntry = { id: parseInt(line) }
        } else if (pendingEntry.startTime === undefined) {
            const spl = line.split("-->")
            if (spl.length !== 2) throw new Error(`Expected 2 timestamps on line ${i}`)
            pendingEntry.startTime = parseTimestamp(spl[0])
            pendingEntry.endTime = parseTimestamp(spl[1])
        } else {
            if (!pendingEntry.text) pendingEntry.text = line
            else pendingEntry.text += "\n" + line
        }
    }
    closePending()
    cleanSubtitleEntries(entries)

    return o
}

export function cleanSubtitleEntries(entries: SubtitleEntry[], sort = true) {
    // .ass files frequently sort themselves by layer
    // this can mean that the OP/ED subs are at the very beginning of the file, causing lots of issues without sorting
    // potentially we should consider add another duplicate check before sorting
    //   if I see some examples where that's useful, I'll add it
    if (sort) entries.sort((a, b) => a.startTime - b.startTime)
    for (let i = entries.length - 1; i > 0; i--) {
        const previous = entries[i - 1]
        if (previous.text === entries[i].text) {
            previous.startTime = Math.min(previous.startTime, entries[i].startTime)
            previous.endTime = Math.max(previous.endTime, entries[i].endTime)
            entries.splice(i, 1)
        }
    }
    for (let i = 0; i < entries.length; i++) {
        entries[i].originalIndex = i
    }
}