using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace MiningHelper.Utils;

public static class MpvUtil
{
    public class SubtitleTrack
    {
        public string? Title;
        public string? Filename;
        public int? FfmpegIndex;
        public string? Lang;
        public int? SrcId;
        public string? Codec;
        public bool CanRead => Codec == "subrip" || Codec == "ass";

        public async Task<byte[]> ReadAsync(string? mpvPath)
        {
            if (!CanRead) throw new Exception("Can't read");
            if (Filename != null)
            {
                if (Filename.StartsWith("https://"))
                {
                    if (Filename.EndsWith(".srt") || Filename.EndsWith(".ass"))
                    {
                        // not too great since there's no cache
                        using var http = new HttpClient();
                        return await http.GetByteArrayAsync(Filename);
                    }
                }
                else if (File.Exists(Filename))
                {
                    if (Filename.EndsWith(".srt"))
                        return await File.ReadAllBytesAsync(Filename);
                    else if (Filename.EndsWith(".ass"))
                    {
                        var arguments = new string[] {
                            "-i", Filename, "-f", "srt", "-"
                        };
                        return await FfmpegUtil.Request(arguments);
                    }
                }
                throw new Exception($"No valid handler for {Filename}");
            }
            else
            {
                if (FfmpegIndex == null || !File.Exists(mpvPath)) throw new Exception();
                var arguments = new string[] {
                    "-i", mpvPath, "-f", "srt", "-map", $"0:{FfmpegIndex}", "-"
                };
                return await FfmpegUtil.Request(arguments);
            }

            throw new Exception($"Failed to handle sub track");
        }
    }
    public static T? Get<T>(this JsonNode node, string key)
    {
        var v = node[key];
        if (v == null) return default;
        return v.GetValue<T>();
    }
    static readonly string[][] AltLangs = [
        ["en", "eng","english"],
        ["ja","jpn","ja","japan", "japanese"]
    ];
    // for now, we should use 2 letter lang codes
    public static SubtitleTrack? TrackForLanguage(this List<SubtitleTrack> tracks, string lang)
    {
        var altLangs = AltLangs.FirstOrDefault(e => e.Contains(lang)) ?? [];
        // probably better way, but this seemed the most readable to me
        var scores = tracks.Select(e =>
        {
            var score = 0;
            if (e.Lang == lang)
                score += 1000;
            else
            {
                foreach (var a in altLangs)
                    if (string.Equals(a, e.Lang, StringComparison.OrdinalIgnoreCase)) score += 500;
            }
            if (e.Filename != null) score += 20;
            if (e.CanRead) score += 10;
            if (e.Title != null)
            {
                if (e.Title.Contains("Songs", StringComparison.OrdinalIgnoreCase)) score -= 1;
                if (e.Title.Contains("Signs", StringComparison.OrdinalIgnoreCase)) score -= 1;
                if (e.Title.Contains("Dialog", StringComparison.OrdinalIgnoreCase)) score += 10;
                // not really sure what these are
                // Star Wars Visions S3 had them
                if (e.Title.Equals("Forced", StringComparison.OrdinalIgnoreCase)) score -= 3;
            }
            return score;
        }).ToList();

        var best = scores.Max();
        if (best <= 0) return null;
        var bestTracks = tracks.Where((e, i) => scores[i] == best).ToList();
        if (bestTracks.Count >= 1) return bestTracks[0]; // if there's more than 1 and we don't like it, adjust the heuristics
        return null;
    }
    public static List<SubtitleTrack> ParseTrackList(JsonNode json)
    {
        var res = new List<SubtitleTrack>();
        foreach (var track in json.AsArray())
        {
            if (track == null) continue;
            if ((string?)track["type"] == "sub")
            {
                res.Add(new SubtitleTrack
                {
                    Title = track.Get<string>("title"),
                    Filename = track.Get<string>("external-filename"),
                    FfmpegIndex = track.Get<int?>("ff-index"),
                    Lang = track.Get<string>("lang"),
                    SrcId = track.Get<int?>("src-id"),
                    Codec = track.Get<string>("codec"),
                });
            }
        }
        return res;
    }

    static readonly JsonSerializerOptions jsonOptions = new() { IncludeFields = true };
    public static void PP(this object? o)
    {
        Console.WriteLine(JsonSerializer.Serialize(o, jsonOptions));
    }
}