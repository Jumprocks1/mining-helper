using System.Collections.Concurrent;
using System.Net;
using System.Net.WebSockets;
using System.Text;

namespace HotReload;

public class WebSocketServer : IDisposable
{
    readonly HttpListener listener = new();
    public const int Port = 413;
    static readonly string Address = $"http://127.0.0.1:{Port}/";
    public WebSocketServer()
    {
        listener.Prefixes.Add(Address);
    }

    public int PreviousWebSocketClientId = 0;
    public ConcurrentDictionary<WebSocket, int>? Clients = new();

    public async Task StartAsync(CancellationToken token)
    {
        listener.Start();
        Console.WriteLine($"CSS HotReload listening on {Address}");
        while (!token.IsCancellationRequested)
        {
            var context = await listener.GetContextAsync();
            var request = context.Request;
            if (request.IsWebSocketRequest)
                _ = HandleWebSocket(context, token);
        }
    }
    async Task HandleWebSocket(HttpListenerContext context, CancellationToken token)
    {
        if (Clients == null) return;
        var client = (await context.AcceptWebSocketAsync(null)).WebSocket;
        var clientId = Interlocked.Increment(ref PreviousWebSocketClientId);
        Clients.TryAdd(client, clientId);
        Console.WriteLine($"Client connected to WebSocket server. Total: {Clients.Count}");

        try
        {
            var buffer = new byte[4096];
            while (!token.IsCancellationRequested)
            {
                var result = await client.ReceiveAsync(buffer, token);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await client.CloseAsync(WebSocketCloseStatus.NormalClosure, null, token);
                    return;
                }
                if (result.EndOfMessage) break;
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
            Console.WriteLine($"Client disconnected from WebSocket server. Total: {Clients.Count}");
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
    public static Task SendMessage(WebSocket webSocket, byte[] message, bool binary)
           => webSocket.SendAsync(
                   message,
                   binary ? WebSocketMessageType.Binary : WebSocketMessageType.Text,
                   endOfMessage: true,
                   CancellationToken.None);
    static Task SendMessage(WebSocket webSocket, string message) => SendMessage(webSocket, Encoding.UTF8.GetBytes(message), false);
}