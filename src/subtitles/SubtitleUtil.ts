import { Subtitles } from "../utils/srt";

// returns undefiend if start and end aren't in the same token
export function getTokenFor(subtitles: Subtitles, startIndex: number, endIndex: number) {
    const jpdb = subtitles.jpdbParse
    if (!jpdb) return
    for (const token of jpdb.tokens) {
        const end = token[0] + token[1]
        if (startIndex >= token[0] && endIndex >= token[0] && startIndex < end && endIndex < end)
            return token
    }
}