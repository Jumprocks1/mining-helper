import { cleanSubtitleEntries, hash, OffsetCache, parseTimestamp, SubtitleEntry, Subtitles } from "./srt";

export async function parseAss(ass: string): Promise<Subtitles> {
    const entries: SubtitleEntry[] = []
    const o: Subtitles = { source: "ass", originalEntries: entries, processedEntries: [], hash: hash(ass) }

    if (o.hash !== undefined) {
        o.offset = await OffsetCache.Get(o.hash)
    }

    const lines = ass.split("\n");
    let category = ""
    let dialogueFormat: string[] = ["Layer", "Start", "End", "Style", "Name", "MarginL", "MarginR", "MarvinV", "Effect", "Text"]
    let indices = new Map<string, number>()
    dialogueFormat.forEach(indices.set)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line.startsWith("[")) {
            category = line.substring(1, line.indexOf("]"))
        }
        if (category !== "Events") continue
        if (line.startsWith("Format:")) {
            dialogueFormat = line.substring("Format:".length).split(",").map(e => e.trim())
            indices.clear()
            dialogueFormat.forEach(indices.set)
        } else if (line.startsWith("Dialogue:")) {
            const spl = line.split(",", indices.get("Text"))
            entries.push({
                startTime: parseTimestamp(spl[indices.get("Start")!]),
                endTime: parseTimestamp(spl[indices.get("End")!]),
                text: spl[indices.get("Text")!]
                    .replace(/\\N/g, "\n"),
                originalIndex: undefined as any // gets set later
            })
        }
    }

    cleanSubtitleEntries(entries)

    return o
}