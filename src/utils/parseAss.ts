import { cleanSubtitleEntries, hash, OffsetCache, parseTimestamp, SubtitleEntry, Subtitles } from "./srt";

export async function parseAss(ass: string): Promise<Subtitles> {
    const styles = new Set<string>()
    const entries: SubtitleEntry[] = []
    const o: Subtitles = { source: "ass", originalEntries: entries, processedEntries: [], hash: hash(ass) }

    if (o.hash !== undefined) {
        o.offset = await OffsetCache.Get(o.hash)
    }

    const lines = ass.split("\n");
    let category = ""
    let dialogueFormat: string[] = ["Layer", "Start", "End", "Style", "Name", "MarginL", "MarginR", "MarvinV", "Effect", "Text"]
    let indices = new Map<string, number>()
    dialogueFormat.forEach((e, i) => indices.set(e, i))
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line.startsWith("[")) {
            category = line.substring(1, line.indexOf("]"))
        }
        if (category !== "Events") continue
        if (line.startsWith("Format:")) {
            dialogueFormat = line.substring("Format:".length).split(",").map(e => e.trim())
            indices.clear()
            dialogueFormat.forEach((e, i) => indices.set(e, i))
        } else if (line.startsWith("Dialogue:")) {
            const spl = line.split(",")
            const style = spl[indices.get("Style")!]
            if (style) styles.add(style)
            entries.push({
                startTime: parseTimestamp(spl[indices.get("Start")!]),
                endTime: parseTimestamp(spl[indices.get("End")!]),
                // would prefer to limit the split instead of join, but limit isn't like c# string split
                text: spl.splice(indices.get("Text")!).join(",")
                    .replace(/\s*\\N\s*/g, "\n"),
                originalIndex: undefined as any, // gets set later
                style
            })
        }
    }

    cleanSubtitleEntries(entries)
    if (styles.size > 0) o.styles = Array.from(styles)

    return o
}