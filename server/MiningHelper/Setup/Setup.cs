using System.IO.Compression;
using MiningHelper.Utils;

namespace MiningHelper.Setup;

public static partial class Setup
{
    static HttpClient Client => field ??= new();
    public static async Task Run()
    {
        Program.Print("Starting setup", ConsoleColor.DarkGray);
        Program.Print("Welcome to Anki Mining Helper", ConsoleColor.Green);
        var apiKey = AppSettings.ApiKey;
        if (apiKey != null)
        {
            Program.Print($"Mining Helper server API key: ", ConsoleColor.Cyan, newLine: false);
            Program.Print(apiKey, ConsoleColor.Magenta);
            Program.Print($"  Please copy the above key into the web interface's 'Server API Key' setting");
        }
        SetupMpv();
        await DownloadKanjiFiles();
        SqliteSeeder.Setup();
        await DownloadFfmpeg();
        Program.Print("Setup complete, press any key to exit");
        Console.ReadKey(true);
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
        if (File.Exists(outputPath))
        {
            Program.Print($"{indent}{outputPath} already exists, skipping download", ConsoleColor.DarkGray);
            return true;
        }
        FileStream? s = null;
        try
        {
            return await AskDownload(indent, url, () =>
             {
                 Directory.CreateDirectory(Path.GetDirectoryName(outputPath)!);
                 return s = new FileStream(outputPath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
             }, sizeEstimate);
        }
        finally
        {
            s?.Dispose();
        }
    }
    public static async Task<bool> AskDownload(string indent, string url, Func<Stream> outputStream, string sizeEstimate)
    {
        Program.Print($"{indent}Would you like to download {url} ({sizeEstimate})?", ConsoleColor.Cyan, newLine: false);
        Program.Print(" (yes/no): ", newLine: false);
        if (!ReadYes(true)) return false;
        Program.Print($"{indent}Downloading {url}", ConsoleColor.DarkGray);
        using var response = await Client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead);
        response.EnsureSuccessStatusCode();
        var size = response.Content.Headers.ContentLength;
        using var contentStream = await response.Content.ReadAsStreamAsync();
        var buffer = new byte[1024 * 10];
        var read = 0;
        var totalRead = 0L;
        var printed = -1L;
        void print(long percent)
        {
            if (printed == percent) return;
            if (percent != 0) Console.SetCursorPosition(0, Console.CursorTop - 1);
            Program.Print($"{indent}Downloading... {totalRead * 100 / size}%", ConsoleColor.DarkGray);
            printed = percent;
        }
        if (size > 0) print(0);
        var output = outputStream();
        while ((read = await contentStream.ReadAsync(buffer)) != 0)
        {
            totalRead += read;
            if (size > 0) print(totalRead * 100 / size.Value);
            output.Write(buffer, 0, read);
        }
        Program.Print($"{indent}Download complete", ConsoleColor.Green);
        return true;
    }

    public static bool ReadYes(bool emptyDefault)
    {
        var response = Console.ReadLine();
        if (string.IsNullOrWhiteSpace(response)) return emptyDefault;
        return "yes".StartsWith(response, StringComparison.InvariantCultureIgnoreCase);
    }

    public static async Task DownloadFfmpeg()
    {
        var ffmpegPath = FfmpegUtil.FfmpegLocation;
        if (ffmpegPath != null)
        {
            Program.Print($"ffmpeg found", ConsoleColor.DarkGray);
            return;
        }
        Program.Print($"ffmpeg not found", ConsoleColor.Yellow);
        Program.Print("  ffmpeg is needed for reading video files");
        Program.Print("  This includes extracting screenshots, audio, and subtitles from mkv files");
        if (!OperatingSystem.IsWindows()) return; // Linux will have to install it on their own
        var libFolder = AppSettings.LibFolder;
        using var zipFile = new MemoryStream();
        var d = await AskDownload("  ", "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip", () => zipFile, "~100MB");
        if (!d) return;
        zipFile.Seek(0, SeekOrigin.Begin);
        using var archive = new ZipArchive(zipFile);
        var ffmpegExe = archive.Entries.FirstOrDefault(e => e.Name == "ffmpeg.exe")
            ?? throw new Exception("Zip file missing ffmpeg.exe");
        await ffmpegExe.ExtractToFileAsync(Path.Join(libFolder, "ffmpeg.exe"));
    }
}