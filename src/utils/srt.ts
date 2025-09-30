interface SubtitleEntry {
    id: number
    startTime: number // milliseconds
    endTime: number
    text: string
    translation?: string
}

export interface Subtitles {
    entries: SubtitleEntry[]
    source: "srt"
    language?: "eng" | "jp"
    name?: string
}

export function timestampString(timestamp: number) {
    let seconds = Math.floor(timestamp / 1000)
    let minutes = Math.floor(seconds / 60)
    seconds -= minutes * 60
    let hours = Math.floor(minutes / 60)
    minutes -= hours * 60
    function f(s: number) {
        return s.toString().padStart(2, "0")
    }
    if (hours <= 0) {
        return `${f(minutes)}:${f(seconds)}`
    } else {
        return `${f(hours)}:${f(minutes)}:${f(seconds)}`
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
            entries.push(pendingEntry as SubtitleEntry)
            pendingEntry = undefined
        }
    }

    const lines = srt.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) { closePending(); continue; }
        if (!pendingEntry) {
            pendingEntry = { id: parseInt(line) }
        } else if (pendingEntry.startTime === undefined) {
            const spl = line.split("-->")
            if (spl.length !== 2) throw new Error(`Expected 2 timestamps on line ${i}`)
            pendingEntry.startTime = parseTimestamp(spl[0])
            pendingEntry.endTime = parseTimestamp(spl[1])
        } else {
            if (!pendingEntry.text) pendingEntry.text = line
            else pendingEntry.text += line
        }
    }

    return o
}