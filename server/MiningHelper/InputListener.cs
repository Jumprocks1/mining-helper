using System.IO.Pipes;
using System.Net;
using System.Text;
using System.Text.Json.Nodes;

namespace MiningHelper;

public enum CommandSource
{
    Stdin,
    WebSocket,
    Http,
}

public class InputListener : IDisposable
{
    NamedPipeClientStream? pipe = null;
    StreamReader? pipeReader = null;
    public StreamWriter? pipeWriter = null;


    readonly CommandHandler Handler;
    readonly StreamReader stdin;

    readonly CancellationTokenSource CancellationTokenSource = new();
    public void Kill() => CancellationTokenSource.Cancel();

    public readonly HttpServer? HttpServer;

    public InputListener()
    {
        Console.OutputEncoding = Encoding.UTF8;
        Console.InputEncoding = Encoding.UTF8;
        stdin = new(Console.OpenStandardInput());
        Handler = new(this);

        if (Program.WebSocket || Program.Http)
        {
            HttpServer = new()
            {
                OnConnect = async _ =>
                {
                    // really don't need to broadcast these, only need to send 1
                    await Handler.BroadcastCurrentTime();
                    await Handler.BroadcastCurrentFile();
                }
            };
        }

    }


    public void RegisterPipe(string? name)
    {
        if (pipe != null) return;
        if (string.IsNullOrWhiteSpace(name)) name = @"tmp\mpv-socket";
        if (name.StartsWith(@"\\.\pipe")) name = name[8..];
        pipe = new(".", name, PipeDirection.InOut, PipeOptions.Asynchronous);
        pipe.Connect(1000);
        pipeReader = new(pipe, Encoding.UTF8);
        pipeWriter = new(pipe, new UTF8Encoding(false)) { NewLine = "\n" };
    }

    public async Task EventLoop()
    {
        Task<string?>? stdinTask = null;
        Task<string?>? pipeTask = null;
        Task<CommandContext>? httpTask = null;

        HttpServer?.StartAsync(CancellationTokenSource.Token);

        if (Program.Pipe != null) RegisterPipe(Program.Pipe);


        var tasks = new List<Task>();
        while (!CancellationTokenSource.IsCancellationRequested)
        {
            tasks.Clear();
            void add(Task? t) { if (t != null) tasks.Add(t); }
            add(stdinTask ??= stdin.ReadLineAsync());
            add(pipeTask ??= pipeReader?.ReadLineAsync());
            add(httpTask ??= HttpServer?.Messages.ReadAsync(CancellationTokenSource.Token).AsTask());

            await Task.WhenAny(tasks);

            if (httpTask != null && httpTask.IsCompleted)
            {
                var context = await httpTask;
                httpTask = null;
                await Handler.Handle(context);
            }
            if (stdinTask.IsCompleted)
            {
                var line = await stdinTask;
                stdinTask = null;
                if (line != null)
                    await Handler.Handle(new(CommandSource.Stdin) { StringData = line });
            }
            if (pipeTask != null && pipeTask.IsCompleted)
            {
                var line = await pipeTask;
                pipeTask = null;
                if (line != null)
                {
                    if (line.Contains("data"))
                    {
                        // {"data":"D:\\qBT\\chainsaw\\[ASW] Chainsaw Man - 07 [1080p HEVC][BEADA5CA].mkv","request_id":0,"error":"success"}
                        var json = JsonNode.Parse(line)!;
                        var requestId = json["request_id"];
                        if (requestId != null)
                        {
                            if (Handler.PendingRequests.TryGetValue((int)requestId, out var callback))
                            {
                                Handler.PendingRequests.Remove((int)requestId);
                                try
                                {
                                    await callback(json["data"]!);
                                }
                                catch (Exception e)
                                {
                                    Program.Log($"Failed to handle response {requestId}: {line}\n{e}");
                                }
                            }
                        }
                    }
                    else
                    {
                        Console.WriteLine(line);
                    }
                }
            }
        }

    }

    public void Dispose()
    {
        pipe?.Dispose();
        HttpServer?.Dispose();
        stdin.Dispose();
    }
}
