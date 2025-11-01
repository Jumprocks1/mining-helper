using System.Diagnostics;

namespace HotReload;

public static class Program
{
    static readonly TimeSpan Debounce = TimeSpan.FromMilliseconds(100);
    public static async Task Main(string[] args)
    {
        for (var i = 0; i < args.Length; i++)
        {
            var arg = args[i];
            if (arg == "--wait-for-debugger")
            {
                while (!Debugger.IsAttached) Thread.Sleep(100);
            }
            else throw new Exception($"Unrecognized argument {arg}");
        }

        var path = "dist";

        using var server = new WebSocketServer();

        if (!File.Exists(path)) throw new DirectoryNotFoundException($"Folder {path} not found. CWD: {Environment.CurrentDirectory}");

        // I'm sure there's a better/thread safer way to do all this, but I'm pretty sure this will be fine
        var queuedChanges = new Dictionary<string, int>();
        using var watcher = new FileSystemWatcher(path);
        watcher.Changed += (_, ev) =>
        {
            var path = ev.FullPath;
            lock (queuedChanges)
            {
                var myI = queuedChanges.TryGetValue(path, out var i) ? i + 1 : 0;
                queuedChanges[path] = myI;
                Task.Run(async () =>
                {
                    await Task.Delay(Debounce);
                    var send = false;
                    lock (queuedChanges)
                    {
                        if (queuedChanges.TryGetValue(path, out var i) && i == myI)
                            send = true;
                    }
                    if (send) await server.SendMessage($"changed:{path}");
                });
            }
        };


        while (true)
        {
            await server.Pump();
        }
    }
}