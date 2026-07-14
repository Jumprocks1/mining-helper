using System.Diagnostics;
using MiningHelper.Utils;

namespace MiningHelper;

public static class Program
{
    public static bool Http { get; private set; } = true;
    public static bool WebSocket { get; private set; } = true;
    public static bool Server { get; private set; } = true;
    public static bool Setup { get; private set; }
    public static string? Pipe { get; private set; } = null;
    public static void Log(string s)
    {
        const int LogMaxLength = 5 * 1024 * 1024;
        if (AppSettings.LogPath != null)
        {
            // not ideal to clear it like this, but it's better than letting it grow infinity if we mess something up
            if (new FileInfo(AppSettings.LogPath).Length > LogMaxLength)
                File.WriteAllText(AppSettings.LogPath, "");
            File.AppendAllText(AppSettings.LogPath, $"{DateTime.Now:hh:mm:ss.fff}: {s.Trim().Replace("\n", "\n  ")}\n");
        }
    }
    public static async Task Main(string[] args)
    {
        try
        {
            AppSettings.Load();

            for (var i = 0; i < args.Length; i++)
            {
                var arg = args[i];
                if (arg == "--wait-for-debugger" || arg == "-d")
                {
                    while (!Debugger.IsAttached) Thread.Sleep(100);
                }
                else if (arg == "--no-server")
                    Server = false;
                else if (arg == "--no-ws")
                    WebSocket = false;
                else if (arg == "--no-http")
                    Http = false;
                else if (arg == "--pipe")
                    Pipe = args[++i];
                else if (arg == "--setup")
                    Setup = true;
                else throw new Exception($"Unrecognized argument {arg}");
            }

            if (Setup)
            {
                await MiningHelper.Setup.Run();
                return;
            }
            if (Server)
            {
                if (HttpServer.Busy)
                {
                    Print($"Port {HttpServer.Port} is already in use", ConsoleColor.Red, true);
                    return;
                }
                using var messageHandler = new InputListener();
                await messageHandler.EventLoop();
            }
        }
        catch (ExitException e)
        {
            Print(e.Message, ConsoleColor.Red, true);
        }
        finally
        {
            ReadingLookup.Dispose();
        }
    }

    public static void Print(string message, ConsoleColor? color = null, bool log = false, bool newLine = true)
    {
        if (log) Log(message);
        if (color == null)
        {
            if (newLine) Console.WriteLine(message);
            else Console.Write(message);
            return;
        }
        var prevColor = Console.ForegroundColor;
        Console.ForegroundColor = color.Value;
        if (newLine) Console.WriteLine(message);
        else Console.Write(message);
        Console.ForegroundColor = prevColor;
    }
}

public class ExitException(string message) : Exception(message)
{
}