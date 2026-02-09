using System.Diagnostics;

namespace MiningHelper.Utils;

public static class FfmpegUtil
{
    public static string[] EnvironmentPath => field ??= (Environment.GetEnvironmentVariable("PATH")?.Split(Path.PathSeparator) ?? []);
    public static bool TryGetEnvironmentLocation(string fileName, out string? fullPath)
    {
        if (File.Exists(fileName))
        {
            fullPath = Path.GetFullPath(fileName);
            return true;
        }

        foreach (var path in EnvironmentPath)
        {
            fullPath = Path.Combine(path, fileName);
            if (File.Exists(fullPath)) return true;
        }
        fullPath = null;
        return false;
    }
    // returns full path
    public static string? LocateExecutable(params string[] locations)
    {
        var libPath = Path.Join(AppSettings.SettingsFolder, "lib");
        const string extension = ".exe";
        foreach (var location in locations)
        {
            var testPath = Path.Join(libPath, location);
            if (File.Exists(testPath))
                return testPath;
            testPath += extension;
            if (File.Exists(testPath))
                return testPath;
        }
        foreach (var location in locations)
        {
            if (TryGetEnvironmentLocation(location, out var fullPath))
                return fullPath;
            if (TryGetEnvironmentLocation(location + extension, out fullPath))
                return fullPath;
        }
        return null;
    }
    public static string? FfmpegLocation => LocateExecutable("ffmpeg");
    public static async Task<byte[]> Request(params string[] args)
    {
        var ffmpeg = FfmpegLocation ?? throw new Exception("ffmpeg not found");
        var startInfo = new ProcessStartInfo(ffmpeg)
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            RedirectStandardInput = true
        };
        foreach (var e in args) startInfo.ArgumentList.Add(e);
        var process = Process.Start(startInfo);

        if (process != null)
        {
            using var stdOut = new MemoryStream();
            await Task.WhenAll(
                process.StandardOutput.BaseStream.CopyToAsync(stdOut),
                process.StandardError.BaseStream.CopyToAsync(Stream.Null),
                process.WaitForExitAsync());
            stdOut.Seek(0, SeekOrigin.Begin);
            return stdOut.ToArray();
        }

        throw new Exception("Failed to request from ffmpeg");
    }
}