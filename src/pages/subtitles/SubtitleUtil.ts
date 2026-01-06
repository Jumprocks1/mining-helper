import { SubtitleEntry, Subtitles } from "../../utils/srt";

// returns undefiend if start and end aren't in the same token
export function getTokenFor(subtitles: Subtitles, startIndex: number, endIndex: number) {
    const jpdb = subtitles.jpdbParse
    if (!jpdb) return
    for (const token of jpdb.tokens) {
        // we are inclusive on end since the indices are selection boundaries
        const end = token[0] + token[1]
        if (startIndex >= token[0] && endIndex >= token[0] && startIndex <= end && endIndex <= end)
            return token
    }
}

// based on 50%+ overlap
export function getSubsInRange(entries: SubtitleEntry[], start: number, end: number) {
    let o = ""
    for (const sub of entries) {
        const overlap = Math.min(end, sub.endTime) - Math.max(start, sub.startTime)
        if (overlap < 0) continue
        const duration = sub.endTime - sub.startTime
        // >50%
        if (overlap * 2 > duration)
            o += sub.text + "\n"
    }
    o = o.replaceAll(/<[^>]*>/g, "") // close enough
    // fansubs have some adorable comments in these
    o = o.replaceAll(/\{[^}]*\}/g, "")
    // dedup lines, Set should preserve order
    return [...new Set(o.split("\n"))].join("\n")
}