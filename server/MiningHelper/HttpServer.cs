using System.Collections.Concurrent;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Threading.Channels;
using MiningHelper.Utils;

namespace MiningHelper;

public class HttpServer : IDisposable
{
    readonly HttpListener listener = new();
    public static int Port => AppSettings.Port;
    const int MaxMessageLength = 1 << 16; // 64 KB
    public Func<WebSocket, Task>? OnConnect;
    public HttpServer()
    {
        listener.Prefixes.Add($"http://127.0.0.1:{Port}/");
    }

    public int PreviousWebSocketClientId = 0;
    public ConcurrentDictionary<WebSocket, int>? Clients = new();

    public async Task StartAsync(CancellationToken token)
    {
        listener.Start();
        while (!token.IsCancellationRequested)
        {
            var context = await listener.GetContextAsync();
            var request = context.Request;
            var origin = request.Headers["Origin"];
            if (!AppSettings.ShouldAllowOrigin(origin) || origin == null)
            {
                context.Response.StatusCode = 403;
                context.Response.Close();
                continue;
            }
            context.Response.AddHeader("Access-Control-Allow-Origin", origin);
            if (context.Request.HttpMethod == "OPTIONS")
            {
                context.Response.AddHeader("Access-Control-Allow-Headers", "X-Api-Key");
                context.Response.StatusCode = (int)HttpStatusCode.OK;
                context.Response.Close();
                continue;
            }

            var requestKey = request.Headers["X-Api-Key"] ?? request.Headers["Sec-WebSocket-Protocol"];
            if (string.IsNullOrWhiteSpace(requestKey) || requestKey != AppSettings.ApiKey)
            {
                context.Response.StatusCode = (int)HttpStatusCode.Unauthorized;
                context.Response.OutputStream.Write(Encoding.UTF8.GetBytes("X-Api-Key header required"));
                context.Response.Close();
                continue;
            }


            if (request.IsWebSocketRequest)
            {
                _ = HandleWebSocket(context, token);
            }
            else
            {
                _ = HandleHttp(context);
            }
        }
    }
    async Task HandleHttp(HttpListenerContext context)
    {
        if (context.Request.HttpMethod != "POST")
        {
            context.Response.StatusCode = (int)HttpStatusCode.MethodNotAllowed;
            await context.Response.OutputStream.WriteAsync(Encoding.UTF8.GetBytes(HttpStatusCode.MethodNotAllowed.ToString()));
            context.Response.Close();
            return;
        }
        using var reader = new StreamReader(context.Request.InputStream);

        var commandContext = new CommandContext(CommandSource.Http)
        {
            HttpContext = context,
            StringData = reader.ReadToEnd(),
            AfterHandled = () =>
            {
                context.Response.Close();
                return Task.CompletedTask;
            }
        };
        await MessageQueue.Writer.WriteAsync(commandContext);
    }

    readonly Channel<CommandContext> MessageQueue = Channel.CreateUnbounded<CommandContext>(new UnboundedChannelOptions
    {
        SingleReader = true,
        AllowSynchronousContinuations = true
    });
    public ChannelReader<CommandContext> Messages => MessageQueue.Reader;

    async Task HandleWebSocket(HttpListenerContext context, CancellationToken token)
    {
        if (Clients == null) return;
        var client = (await context.AcceptWebSocketAsync(AppSettings.ApiKey)).WebSocket;
        var clientId = Interlocked.Increment(ref PreviousWebSocketClientId);
        Clients.TryAdd(client, clientId);
        Console.WriteLine($"Client connected to WebSocket server");
        if (OnConnect != null)
            await OnConnect(client);

        try
        {
            var buffer = new byte[4096];
            while (!token.IsCancellationRequested)
            {
                using var ms = new MemoryStream();
                while (!token.IsCancellationRequested)
                {
                    var result = await client.ReceiveAsync(buffer, token);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await client.CloseAsync(WebSocketCloseStatus.NormalClosure, null, token);
                        return;
                    }
                    ms.Write(buffer, 0, result.Count);
                    if (ms.Length > MaxMessageLength) throw new Exception("Max message length exceeded");
                    if (result.EndOfMessage) break;
                }
                MessageQueue.Writer.TryWrite(new CommandContext(CommandSource.WebSocket)
                {
                    Data = ms.ToArray(),
                    WebSocket = client
                });
            }
            await client.CloseAsync(WebSocketCloseStatus.NormalClosure, null, token);
        }
        catch (WebSocketException)
        {
            // Connection lost
        }
        finally
        {
            Clients.Remove(client, out _);
            client.Dispose();
        }
    }

    public void Dispose()
    {
        listener.Close();
        if (Clients != null)
        {
            foreach (var (client, _) in Clients)
                client.Dispose();
            Clients = null;
        }
    }

    public async Task BroadcastMessage(string message)
    {
        if (Clients == null) return;
        foreach (var (client, _) in Clients)
            await SendMessage(client, message);
    }

    public async Task BroadcastBinary(byte[] bytes)
    {
        if (Clients == null) return;
        foreach (var (client, _) in Clients)
            await SendMessage(client, bytes, true);
    }

    public static Task SendMessage(WebSocket webSocket, byte[] message, bool binary)
           => webSocket.SendAsync(
                   message,
                   binary ? WebSocketMessageType.Binary : WebSocketMessageType.Text,
                   endOfMessage: true,
                   CancellationToken.None);
    static Task SendMessage(WebSocket webSocket, string message) => SendMessage(webSocket, Encoding.UTF8.GetBytes(message), false);
}