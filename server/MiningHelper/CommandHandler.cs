using System.Diagnostics;
using System.Globalization;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using MiningHelper.Utils;

namespace MiningHelper;


// would probably be better to have virtual methods on this instead of lots of if statements
// could store WebSocketServer inside the subclass and force it to non-null
public class CommandContext
{
    public readonly CommandSource Source;
    public CommandContext(CommandSource source)
    {
        Source = source;
    }
    public string? RequestId;

    public string? StringData;
    public string NotNullStringData => StringData ?? Encoding.UTF8.GetString(Data ?? throw new Exception());
    public byte[]? Data;

    public Func<Task>? AfterHandled;
    public Task Complete()
    {
        return AfterHandled?.Invoke() ?? Task.CompletedTask;
    }

    public HttpListenerContext? HttpContext;
    public WebSocket? WebSocket;

    public void Error(string error)
    {
        if (Source == CommandSource.Http && HttpContext != null)
        {
            if (HttpContext.Response.StatusCode == (int)HttpStatusCode.OK)
                HttpContext.Response.StatusCode = (int)HttpStatusCode.BadRequest;
            HttpContext.Response.OutputStream.Write(Encoding.UTF8.GetBytes(error));
        }
        else Program.Log(error);
        Console.WriteLine(error);
    }


    public async Task SendBinaryResponse(byte[]? data, string mime)
    {
        if (data == null) throw new Exception($"Missing data for response {RequestId}");
        if (Source == CommandSource.WebSocket)
        {
            if (RequestId == default) throw new Exception("Missing request ID");
            var socket = WebSocket ?? throw new Exception("Missing WebSocket");
            await HttpServer.SendMessage(socket, CommandHandler.PackData($"response:{RequestId}:", data), true);
        }
        else if (HttpContext != null)
        {
            HttpContext.Response.ContentType = mime;
            await HttpContext.Response.OutputStream.WriteAsync(data);
        }
        else throw new Exception("No valid response handler");
    }
}

public class CommandHandler
{
    public HttpServer? HttpServer => InputListener.HttpServer;
    public readonly InputListener InputListener;

    public CommandHandler(InputListener listener)
    {
        InputListener = listener;
    }
    public float CurrentTime = 0;
    public string? CurrentFile; // "" => no file, null => unknown


    public Task BroadcastCurrentTime() => HttpServer?.BroadcastMessage("t:" + CurrentTime.ToString(CultureInfo.InvariantCulture)) ?? Task.CompletedTask;
    public Task BroadcastCurrentFile()
    {
        if (HttpServer == null) return Task.CompletedTask;
        if (CurrentFile == null) return Task.CompletedTask;
        return HttpServer.BroadcastMessage("current-file:" + CurrentFile);
    }


    int nextRequestId = 1;
    public Dictionary<int, Func<JsonNode, Task>> PendingRequests = [];
    // these take like 1ms, it's very fast
    public async Task IpcRequest(string request, Func<JsonNode, Task> callback)
    {
        var writer = InputListener.pipeWriter;
        if (writer != null)
        {
            PendingRequests[nextRequestId] = callback;
            await writer.WriteLineAsync($"{{\"command\": {request}, \"request_id\": {nextRequestId++}}}");
            await writer.FlushAsync();
        }
    }

    // TODO technically should allow binary command data,
    // but hasn't been needed yet since all the binary data originates from this program
    public async Task Handle(CommandContext context)
    {
        var command = context.NotNullStringData;
        try
        {
            var source = context.Source;
            var spl = command.Split(':', 2);
            var commandName = spl[0];
            var commandValue = spl.Length > 1 ? spl[1] : null;
            string? nextParameter()
            {
                if (commandValue == null) return null;
                var spl2 = commandValue.Split(':', 2);
                commandValue = spl2.Length > 1 ? spl2[1] : null;
                return spl2[0];
            }

            async Task returnSubs(string lang)
            {
                var writer = InputListener.pipeWriter;
                if (writer != null)
                {
                    await IpcRequest("""["get_property", "track-list"]""", async json =>
                    {
                        var track = MpvUtil.ParseTrackList(json).TrackForLanguage(lang);
                        if (track == null) return;
                        if (track.Codec == "hdmv_pgs_subtitle")
                        {
                            await SendResponse(context, "subtitles are in pgs (image) format");
                            return;
                        }
                        var bytes = await track.ReadAsync(CurrentFile);
                        await context.SendBinaryResponse(bytes, "application/x-subrip");
                    });
                }
            }

            if (commandName == "kill")
            {
                InputListener.Kill();
            }
            else if (commandName == "time")
            {
                if (float.TryParse(commandValue, out var f))
                {
                    CurrentTime = f;
                    await BroadcastCurrentTime();
                }
            }
            else if (commandName == "current-file")
            {
                CurrentFile = commandValue;
                await BroadcastCurrentFile();
            }
            else if (commandName == "pipe")
            {
                InputListener.RegisterPipe(commandValue);
            }
            else if (commandName == "ipc")
            {
                var writer = InputListener.pipeWriter;
                if (writer != null)
                {
                    await writer.WriteLineAsync(commandValue);
                    await writer.FlushAsync();
                }
            }
            else if (commandName == "ipc-request")
            {
                await IpcRequest(commandValue!, async response =>
                {
                    await SendResponse(context, response.ToString());
                });
            }
            else if (commandName == "forward" || commandName == "f" || commandName == "")
            {
                if (HttpServer != null)
                    await HttpServer.BroadcastMessage(commandValue!);
            }
            else if (commandName == "jp-subs")
            {
                await returnSubs("ja");
            }
            else if (commandName == "english-subs")
            {
                await returnSubs("en");
            }
            else if (commandName == "image")
            {
                if (CurrentFile != null)
                {
                    var vRes = Math.Clamp(int.Parse(nextParameter()!), 1, 2160);
                    var start = int.Parse(commandValue!);
                    var image = await FfmpegUtil.Request(
                        "-ss", ((double)start / 1000).ToString(CultureInfo.InvariantCulture),
                        "-i", CurrentFile,
                        "-frames:v", "1", "-update", "1", // not really sure what update does exactly, but it's recommended
                        "-q:v", "5",
                        "-vf", $"scale=-1:{vRes}",
                        "-f", "image2pipe", "-vcodec", "mjpeg", "-"
                    );
                    await context.SendBinaryResponse(image, "image/jpeg");
                }
            }
            else if (commandName == "lookup-audio")
            {
                await SendResponse(context, ReadingLookup.LookupAudio(nextParameter()!, nextParameter()));
            }
            else if (commandName == "audio-bytes")
            {
                await context.SendBinaryResponse(ReadingLookup.GetAudioBytes(int.Parse(commandValue!)), "audio/mpeg");
            }
            else if (commandName == "audio-bytes-kanji")
            {
                var audio = ReadingLookup.LookupAudioSingle(nextParameter()!, nextParameter());
                if (audio != null)
                    await context.SendBinaryResponse(ReadingLookup.GetAudioBytes(audio.ID), "audio/mpeg");
            }
            else if (commandName == "request")
            {
                context.RequestId = nextParameter();
                context.StringData = commandValue;
                await Handle(context);
            }
            else if (commandName == "mpv-audio")
            {
                if (CurrentFile != null)
                {
                    var spl2 = commandValue!.Split("-", 2);
                    var start = int.Parse(spl2[0]);
                    var end = int.Parse(spl2[1]);
                    await IpcRequest(@"[""get_property"", ""current-tracks/audio/ff-index""]", async i =>
                    {
                        var arguments = new string[] {
                            // it's significantly faster putting the `-ss` before the input file
                        "-ss", ((double)start / 1000).ToString(CultureInfo.InvariantCulture),
                        "-i", CurrentFile,"-map","0:" + (int)i,
                        "-vn", "-to", ((double)(end - start) / 1000).ToString(CultureInfo.InvariantCulture),
                        "-f", "ogg","-"
                        };
                        var stdOut = await FfmpegUtil.Request(arguments);
                        await context.SendBinaryResponse(stdOut, "audio/ogg");
                    });
                }
            }
            else context.Error($"unrecognized {source} command: {command}");
        }
        catch (Exception e)
        {
            context.Error($"Failed to handle command: {command}\n{e}");
        }
        await context.Complete();
    }


    public Task SendResponse<T>(CommandContext context, T data)
    {
        if (context.HttpContext != null)
            context.HttpContext.Response.ContentType = "application/json";
        return SendResponse(context, JsonSerializer.Serialize(data));
    }
    public Task SendResponse(CommandContext context, string data)
    {
        var message = $"response:{context.RequestId}:{data}";
        if (context.Source == CommandSource.WebSocket && HttpServer != null)
            return HttpServer.BroadcastMessage(message);
        else if (context.HttpContext != null)
        {
            context.HttpContext.Response.OutputStream.Write(Encoding.UTF8.GetBytes(data));
            return Task.CompletedTask;
        }
        else
        {
            Console.WriteLine(message);
            return Task.CompletedTask;
        }
    }
    public Task WebSocketBinaryBroadcast(string prefix, byte[] data)
    {
        if (HttpServer == null) throw new Exception("WebSocket not running");
        return HttpServer.BroadcastBinary(PackData(prefix, data));
    }
    public static byte[] PackData(string prefix, byte[] data)
    {
        var buffer = new byte[data.Length + prefix.Length];
        Encoding.UTF8.GetBytes(prefix, buffer.AsSpan());
        Buffer.BlockCopy(data, 0, buffer, prefix.Length, data.Length);
        return buffer;
    }
}
