export interface SubtitleEntry {
    id: number
    startTime: number // milliseconds
    endTime: number
    text: string
    translation?: string
    node?: HTMLElement
}

export interface Subtitles {
    offset?: number
    entries: SubtitleEntry[]
    source: "srt"
    language?: "eng" | "jp"
    name?: string
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

function parseTimestamp(timestamp: string) {
    timestamp = timestamp.replace(".", ",").trim()
    const [hours, minutes, partialSeconds] = timestamp.split(":")
    const [seconds, partialS] = partialSeconds.split(",")
    const milliseconds = parseInt(partialS) * Math.pow(10, 3 - partialS.length)
    return ((parseInt(hours) * 60 + parseInt(minutes)) * 60 + parseInt(seconds)) * 1000 + milliseconds
}

export function parseSrt(srt: string): Subtitles {
    const entries: SubtitleEntry[] = []
    const o: Subtitles = { source: "srt", entries }

    let pendingEntry: Partial<SubtitleEntry> | undefined = undefined

    function closePending() {
        if (pendingEntry) {
            pendingEntry.text = pendingEntry.text?.trim()
            entries.push(pendingEntry as SubtitleEntry)
            pendingEntry = undefined
        }
    }

    const lines = srt.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) { closePending(); continue; }

        // these few lines feel invalid to me, but .srt for HxH ep 6 had lines that needed this
        // sometimes there are empty subtitle entries with no new line after them, this handles that (sketchily)
        // downside is it would crash if the ~nth subtitle entry was "n"
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

    return o
}