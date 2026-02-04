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
        if (AppSettings.LogPath != null)
            File.AppendAllText(AppSettings.LogPath, $"{DateTime.Now:hh:mm:ss.fff}: {s.Trim()}\n");
    }
    public static async Task Main(string[] args)
    {
        try
        {
            AppSettings.Load();

            for (var i = 0; i < args.Length; i++)
            {
                var arg = args[i];
                if (arg == "--wait-for-debugger")
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
                Console.WriteLine("Starting first time setup");
                SqliteSeeder.Setup();
                return;
            }
            if (Server)
            {
                using var messageHandler = new InputListener();
                await messageHandler.EventLoop();
            }
        }
        catch (ExitException e)
        {
            Print(e.Message, ConsoleColor.Red);
        }
        finally
        {
            ReadingLookup.Dispose();
        }
    }

    public static void Print(string message, ConsoleColor? color = null)
    {
        if (color == null)
        {
            Console.WriteLine(message);
            return;
        }
        var prevColor = Console.ForegroundColor;
        Console.ForegroundColor = color.Value;
        Console.WriteLine(message);
        Console.ForegroundColor = prevColor;
    }
}

public class ExitException(string message) : Exception(message)
{
}