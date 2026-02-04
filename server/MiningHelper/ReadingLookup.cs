using System.IO.Compression;
using System.Text.Json.Serialization;
using Microsoft.Data.Sqlite;
using MiningHelper.Utils;

namespace MiningHelper;

public static class ReadingLookup
{
    public class AudioEntry
    {
        public string? Source { get; init; }
        public string? File { get; init; }
        public string? Reading { get; init; }
        public int ID { get; init; }

        [JsonIgnore] public string ZipEntryName => $"{Source}_files/{File}";
    }

    // not on list for some reason => go to last
    static readonly string[] SourcePreference = [
        "taas",
        "nhk16",
        "shinmeikai8",
        "daijisen",
        "jpod",

        // haven't tried these much yet
        "forvo",
        "forvo_ext",
        "forvo_ext2",
        "ozk5",
    ];

    static SqliteConnection OpenConnection
    {
        get
        {
            var c = new SqliteConnection($"Data Source={SqliteSeeder.DbFile}");
            c.Open();
            return c;
        }
    }
    public static List<AudioEntry> LookupAudio(string kanji, string? reading)
    {
        using var connection = OpenConnection;

        var command = connection.CreateCommand();
        command.CommandText = @"
        SELECT id, reading, source, display, file
        FROM entries
        WHERE expression = @expression
        ";
        command.Parameters.AddWithValue("@expression", kanji);
        using var reader = command.ExecuteReader();
        var res = new List<AudioEntry>();
        while (ReadEntry(reader, out var entry))
            res.Add(entry);

        if (!string.IsNullOrWhiteSpace(reading))
        {
            res = [.. res.GroupBy(e => e.Source).SelectMany(e =>
            {
                var filtered = e.Where(e => e.Reading == reading).ToList();
                if (filtered.Count > 0) return filtered.AsEnumerable();
                return e;
            })];
        }

        return [.. res.OrderBy(e =>
        {
            var i = Array.IndexOf(SourcePreference, e.Source);
            return i == -1 ? int.MaxValue : i;
        })];
    }
    // have to pull all of them really to get the proper priority order
    public static AudioEntry? LookupAudioSingle(string kanji, string? reading) => LookupAudio(kanji, reading).FirstOrDefault();

    // the first open costs ~900ms
    // if we didn't cache this, secondary opens cost 600ms
    // when cached, takes 0ms
    // the decompression of 1 mp3 file takes 0.1ms after zip is open
    static ZipArchive? _zipArchive;
    static readonly object _lock = new();
    public static ZipArchive ZipArchive
    {
        get
        {
            lock (_lock)
            {
                return _zipArchive ??= new ZipArchive(File.OpenRead(AppSettings.GetPath("AudioDataZip")));
            }
        }
    }
    public static byte[]? GetAudioBytes(AudioEntry entry)
    {
        var zipEntry = ZipArchive.GetEntry(entry.ZipEntryName)
            ?? throw new FileNotFoundException($"Failed to locate {entry.ZipEntryName}");
        using var stream = zipEntry.Open();
        using var memoryStream = new MemoryStream();
        stream.CopyTo(memoryStream);
        return memoryStream.ToArray();
    }
    public static byte[]? GetAudioBytes(int id)
    {
        using var connection = OpenConnection;
        var command = connection.CreateCommand();
        command.CommandText = @"
        SELECT id, reading, source, display, file
        FROM entries
        WHERE id = @id
        ";
        command.Parameters.AddWithValue("@id", id);
        using var reader = command.ExecuteReader();
        if (!ReadEntry(reader, out var entry)) throw new Exception($"ID {id} not found");
        return GetAudioBytes(entry);
    }

    static bool ReadEntry(SqliteDataReader reader, out AudioEntry entry)
    {
        var success = reader.Read();
        if (!success)
        {
            entry = new();
            return success;
        }
        entry = new AudioEntry
        {
            File = reader.GetString(reader.GetOrdinal("file")),
            Source = reader.GetString(reader.GetOrdinal("source")),
            Reading = reader.GetString(reader.GetOrdinal("reading")),
            ID = reader.GetInt32(reader.GetOrdinal("id"))
        };
        return success;
    }

    // not sure if this really does anything?
    public static void Dispose()
    {
        _zipArchive?.Dispose();
        _zipArchive = null;
    }
}