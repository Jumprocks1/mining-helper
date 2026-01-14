using System.Diagnostics;
using System.Security.Principal;

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

        if (!Directory.Exists(path)) throw new DirectoryNotFoundException($"Folder {path} not found. CWD: {Environment.CurrentDirectory}");

        var queuedChanges = new Dictionary<string, CancellationTokenSource>();
        using var watcher = new FileSystemWatcher(path) { EnableRaisingEvents = true };
        watcher.Changed += (_, ev) =>
        {
            var cts = new CancellationTokenSource();
            var path = ev.FullPath;
            lock (queuedChanges)
            {
                if (queuedChanges.TryGetValue(path, out var old))
                    old.Cancel();
                queuedChanges[path] = cts;
            }
            async void debounced()
            {
                try
                {

                    await Task.Delay(Debounce, cts.Token);
                    await server.BroadcastMessage($"changed:{path}");
                }
                catch (TaskCanceledException) { return; }
                finally
                {
                    lock (queuedChanges)
                    {
                        if (queuedChanges.TryGetValue(path, out var current) && current == cts)
                            queuedChanges.Remove(path);
                    }
                }
            }
            debounced();
        };

        var cancellationTokenSource = new CancellationTokenSource();
        await server.StartAsync(cancellationTokenSource.Token);
    }
}