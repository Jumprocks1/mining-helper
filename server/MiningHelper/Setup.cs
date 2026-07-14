using MiningHelper.Utils;

namespace MiningHelper;

public static class Setup
{
    static HttpClient Client => field ??= new();
    public static async Task Run()
    {
        Program.Print("Starting setup", ConsoleColor.DarkGray);
        Program.Print("Welcome to Anki Mining Helper", ConsoleColor.Green);
        SetupMpv();
        SqliteSeeder.Setup();
        await DownloadKanjiFiles();
    }
    public static void SetupMpv()
    {
        // TODO check for mpv and move script (same as ps1 script)
    }

    public static async Task DownloadKanjiFiles()
    {
        static async Task<bool> check(string path, string url, string sizeEstimate)
        {
            if (!File.Exists(path))
            {
                Program.Print($"{Path.GetFileName(path)} missing", ConsoleColor.Yellow);
                Program.Print("  This file is only needed if you plan on creating kanji cards.");
                Program.Print("  This is not needed for mining vocab cards.");
                var d = await AskDownload("  ", url, path, sizeEstimate);
                if (!d) return false;
            }
            else Program.Print($"{Path.GetFileName(path)} found", ConsoleColor.DarkGray);
            return true;
        }
        if (!await check(AppSettings.KanjiDicPath, "https://www.edrdg.org/kanjidic/kanjidic2.xml.gz", "~1.5MB"))
            return;
        if (!await check(AppSettings.KradFilePath, "https://www.edrdg.org/pub/Nihongo/kradfile.gz", "~50kB"))
            return;
    }

    public static async Task<bool> AskDownload(string indent, string url, string outputPath, string sizeEstimate)
    {
        Program.Print($"{indent}Would you like to download {url} ({sizeEstimate})?", ConsoleColor.Cyan, newLine: false);
        Program.Print(" (yes/no): ", newLine: false);
        if (!ReadYes(true)) return false;
        Program.Print($"{indent}Downloading {url}", ConsoleColor.DarkGray);
        using var response = await Client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        using var file = new FileStream(outputPath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        await response.Content.CopyToAsync(file);
        Program.Print($"{indent}Download complete", ConsoleColor.Green);
        return true;
    }

    public static bool ReadYes(bool emptyDefault)
    {
        var response = Console.ReadLine();
        if (string.IsNullOrWhiteSpace(response)) return emptyDefault;
        return "yes".StartsWith(response, StringComparison.InvariantCultureIgnoreCase);
    }
}