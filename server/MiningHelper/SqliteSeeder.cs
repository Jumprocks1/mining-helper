using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Data.Sqlite;
using MiningHelper.Utils;

namespace MiningHelper;

public static class SqliteSeeder
{
    public static string DbFile => AppSettings.GetOptionalPath("AudioDataSql")
        ?? Path.Join(Path.GetDirectoryName(ZipFile), "audio-source.db");
    public static string ZipFile => AppSettings.GetPath("AudioDataZip");
    public static void Setup()
    {
        Console.WriteLine("Checking for existing database file");
        if (File.Exists(DbFile))
        {
            Console.WriteLine($"{DbFile} already exists, skipping db setup");
            return;
        }
        Console.WriteLine($"{DbFile} not found, seeding");
        if (!File.Exists(ZipFile))
        {
            throw new ExitException($"{ZipFile} not found.\nIf you already have this file, please update appsettings.json to point to it.\n"
                + "If not, please download it from Nyaa. You can find it by searching for \"Yomitan Ultimate Japanese Audio Source\".");
        }
        Program.Print($"{ZipFile} found", ConsoleColor.Green);
        var archive = ReadingLookup.ZipArchive;
        var entry = archive.GetEntry("entry_and_pitch_db.sql") ?? throw new ExitException("entry_and_pitch_db.sql not found in zip");
        const int expectedLength = 118599536;
        if (entry.Length == expectedLength)
            Program.Print("SQL file length matches as expected", ConsoleColor.Green);
        else
            Program.Print($"SQL file length differs from expected ({expectedLength}), continuing anyways", ConsoleColor.Yellow);
        using var stream = entry.Open();
        Load(stream);
    }
    public static void Load(Stream stream)
    {
        using var _ = stream;

        // of course it's super silly to parse SQL instead of just running it directly
        // but in my testing this runs at least 10x, maybe 100x faster than directly running the sql
        Console.WriteLine("Parsing SQL");

        var regex = new Regex(@"^INSERT INTO ([\S]+) VALUES\((.+)\);$");

        var allData = new List<(string, List<object>)>();

        var create = new StringBuilder();
        var l = new List<object>();
        var pending = "";
        void pushPending()
        {
            if (pending.StartsWith('\''))
                l.Add(pending[1..^1]);
            else if (pending == "NULL")
                l.Add(DBNull.Value);
            else
                l.Add(int.Parse(pending));
            pending = "";
        }

        using var streamReader = new StreamReader(stream);

        string? line;
        while ((line = streamReader.ReadLine()) != null)
        {
            if (line.StartsWith("INSERT"))
            {
                // INSERT INTO entries VALUES(1,'帯広','おびひろ','nhk16',NULL,'オビヒロ [0,2]','audio/20180222110605.mp3');
                var match = regex.Match(line);
                if (!match.Success) throw new Exception();
                var table = match.Groups[1].Value;
                var values = match.Groups[2].Value;
                var s = false;
                for (var i = 0; i < values.Length; i++)
                {
                    var c = values[i];
                    if (!s && c == ',') pushPending();
                    else
                    {
                        if (c == '\'') s = !s;
                        pending += c;
                    }
                }
                pushPending();
                allData.Add((table, l));
                l = [];
            }
            else
            {
                create.AppendLine(line);
            }
        }

        Console.WriteLine("SQL parsing complete, building database");

        using var connection = new SqliteConnection($"Data Source={DbFile}");
        connection.Open();

        {
            using var c1 = connection.CreateCommand();
            c1.CommandText = string.Join('\n', create);
            c1.ExecuteNonQuery();
        }

        foreach (var tableGroup in allData.GroupBy(e => e.Item1))
        {
            string insertCommand;
            string[] parameters;
            if (tableGroup.Key == "entries")
            {
                parameters = ["@id", "@expression", "@reading", "@source", "@speaker", "@display", "@file"];
                insertCommand = $"INSERT INTO entries VALUES(@)";
            }
            else
            {
                // INSERT INTO pitch_accents VALUES(181407,'見惚れる','みほれる','ミホレ''ル',1);
                parameters = ["@id", "@expression", "@reading", "@pitch", "@count"];
                insertCommand = $"INSERT INTO pitch_accents VALUES(@)";
            }
            insertCommand = insertCommand.Replace("@", string.Join(',', parameters));
            var i = 0;
            var chunks = tableGroup.Chunk(100_000).ToList();
            foreach (var chunk in chunks)
            {
                Console.WriteLine($"starting chunk {++i} of {chunks.Count} for table '{tableGroup.Key}'");
                using var transaction = connection.BeginTransaction();

                using var command = connection.CreateCommand();
                command.CommandText = insertCommand;

                var parameterValues = new SqliteParameter[parameters.Length];
                for (var j = 0; j < parameters.Length; j++)
                {
                    parameterValues[j] = command.CreateParameter();
                    parameterValues[j].ParameterName = parameters[j];
                    command.Parameters.Add(parameterValues[j]);
                }
                foreach (var entry in chunk)
                {
                    var entryData = entry.Item2;
                    for (var j = 0; j < parameters.Length; j++)
                        parameterValues[j].Value = entryData[j];
                    command.ExecuteNonQuery();
                }

                transaction.Commit();
            }
        }
        Program.Print("SQL setup complete", ConsoleColor.Green);
    }
}