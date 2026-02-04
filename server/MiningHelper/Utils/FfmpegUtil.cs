using System.Diagnostics;

namespace MiningHelper.Utils;

public static class FfmpegUtil
{
    public static async Task<byte[]> Request(params string[] args)
    {
        var startInfo = new ProcessStartInfo("ffmpeg")
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