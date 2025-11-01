using System.Buffers.Binary;
using System.Net;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;

namespace HotReload;

// https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_server
public class WebSocketServer : IDisposable
{
    public const int Port = 413;
    const int MaxMessageLength = 1 << 16; // 64 KB
    const string KeyHeader = "Sec-WebSocket-Key: ";

    readonly TcpListener listener;

    public WebSocketServer()
    {
        listener = new TcpListener(IPAddress.Parse("127.0.0.1"), Port);
        listener.Start();
    }

    TcpClient? Client;
    NetworkStream? Stream;

    public async Task<(Operation, byte[]?)> Pump()
    {
        try
        {
            if (Client == null)
            {
                Console.WriteLine($"Waiting for WebSocket client");
                Client = await listener.AcceptTcpClientAsync();
                Stream ??= Client.GetStream();
                Console.WriteLine($"Client connected to WebSocket server");
            }

            var buffer = new byte[4096];
            var offset = 0;
            while (true)
            {
                if (buffer.Length < offset + 512)
                {
                    if (buffer.Length * 2 > MaxMessageLength) throw new NotSupportedException();
                    var oldBuffer = buffer;
                    buffer = new byte[buffer.Length * 2];
                    Array.Copy(oldBuffer, buffer, offset);
                }
                if (Stream != null)
                {
                    offset += await Stream.ReadAsync(buffer.AsMemory(offset, buffer.Length - offset));
                    if (Stream.DataAvailable) continue;
                    var message = ParseMessage(Stream, buffer, offset, out var operation);
                    if (operation == Operation.Close)
                    {
                        CloseClient();
                    }
                    return (operation, message);
                }
                offset = 0;
            }
        }
        catch (IOException e) when (e.InnerException is SocketException se && se.SocketErrorCode == SocketError.ConnectionAborted)
        {
            Console.WriteLine($"Client disconnected");
            CloseClient();
        }
        catch (SocketException e) when (e.SocketErrorCode == SocketError.Interrupted)
        {
            // means we canceled the listener by disposing calling server.Stop()
            CloseClient();
        }
        return (Operation.None, null);
    }

    public enum Operation
    {
        None,
        Message,
        Open,
        Close
    }


    static byte[]? ParseMessage(NetworkStream stream, byte[] buffer, int length, out Operation operation)
    {
        if (buffer.Length == 0)
        {
            operation = Operation.None;
            return null;
        }
        var s = Encoding.UTF8.GetString(buffer, 0, length);

        if (buffer[0] == 'G') // the first byte of a websocket message should never be even close to 'G'
        {
            // see https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_server
            var keyI = s.IndexOf(KeyHeader) + KeyHeader.Length;
            var keyEnd = s.IndexOf('\n', keyI);
            var swk = s[keyI..keyEnd].Trim();
            string swka = swk + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
            string swkaSha1 = Convert.ToBase64String(SHA1.HashData(Encoding.UTF8.GetBytes(swka)));

            // HTTP/1.1 defines the sequence CR LF as the end-of-line marker
            byte[] response = Encoding.UTF8.GetBytes(
                "HTTP/1.1 101 Switching Protocols\r\n" +
                "Connection: Upgrade\r\n" +
                "Upgrade: websocket\r\n" +
                "Sec-WebSocket-Accept: " + swkaSha1 + "\r\n\r\n");

            stream.Write(response, 0, response.Length);
            operation = Operation.Open;
            return null;
        }

        var fin = (buffer[0] & 0b10000000) != 0;
        var mask = (buffer[1] & 0b10000000) != 0;

        var opcode = buffer[0] & 0b00001111; // expecting 1 - text message or 2 - binary
        if (opcode == 8) // close connection
        {
            operation = Operation.Close;
            return null;
        }
        var msglen = buffer[1] & 0b01111111;

        var offset = 2;

        if (msglen == 126)
        {
            msglen = BinaryPrimitives.ReadUInt16BigEndian(buffer.AsSpan(2));
            offset += 2;
        }
        else if (msglen == 127)
        {
            var longLength = BinaryPrimitives.ReadUInt64BigEndian(buffer.AsSpan(2));
            if (longLength > int.MaxValue) throw new NotSupportedException();
            msglen = (int)longLength;
            offset += 8;
        }
        if (mask)
        {
            var decoded = new byte[msglen];
            var masks = new byte[4] { buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3] };
            offset += 4;
            for (int i = 0; i < msglen; ++i)
                decoded[i] = (byte)(buffer[offset + i] ^ masks[i % 4]);
            operation = Operation.Message;
            return decoded;
        }
        else
        {
            Console.WriteLine("mask not set");
            operation = Operation.None;
            return null;
        }
    }

    public void CloseClient()
    {
        Client?.Dispose();
        Client = null;
        Stream?.Dispose();
        Stream = null;
    }

    public void Dispose()
    {
        listener.Stop();
        CloseClient();
    }

    // not 100% sure if this is threadsafe with how we do everything
    public async ValueTask SendMessage(string message)
    {
        try
        {
            if (Stream != null)
                await SendMessage(Stream, message);
        }
        catch (Exception e)
        {
            Console.WriteLine($"Exception when sending message\n{e}");
        }
    }

    public ValueTask SendBinary(byte[] bytes)
    {
        if (Stream != null)
            return SendMessage(Stream, bytes, true);
        return ValueTask.CompletedTask;
    }

    // public void SendJson(object json) => SendMessage(stream, JsonConvert.SerializeObject(json));
    static ValueTask SendMessage(NetworkStream stream, byte[] message, bool binary)
    {
        // https://datatracker.ietf.org/doc/html/rfc6455#section-5.2
        byte[] output;
        void buildOutput(int offset)
        {
            output = new byte[message.Length + offset];
            output[0] = (byte)(0b1000_0000 | (binary ? 2 : 1)); // fin bit + text message
            Buffer.BlockCopy(message, 0, output, offset, message.Length);
        }
        if (message.Length <= 125)
        {
            buildOutput(2);
            output[1] = (byte)message.Length;
        }
        else if (message.Length <= ushort.MaxValue)
        {
            buildOutput(4);
            output[1] = 126;
            BinaryPrimitives.WriteUInt16BigEndian(output.AsSpan(2), (ushort)message.Length);
        }
        else
        {
            // we only check the int 32 length, so this doesn't actually support full 64 bits
            buildOutput(10);
            output[1] = 127;
            BinaryPrimitives.WriteUInt64BigEndian(output.AsSpan(2), (ulong)message.Length);
        }

        return stream.WriteAsync(output);
    }
    static ValueTask SendMessage(NetworkStream stream, string message) => SendMessage(stream, Encoding.UTF8.GetBytes(message), false);
}