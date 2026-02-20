using MiningHelper.Utils;

namespace MiningHelper;

public static class ValidateSetup
{
    public static async Task<object> Validate(InputListener listener)
    {
        // ~/.config/mpv/scripts
        var mpvLocation = Path.Join(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "mpv");
        var script = Path.Join(mpvLocation, "scripts", "mining_helper.lua");
        return new
        {
            connected = true,
            ffmpegFound = FfmpegUtil.FfmpegLocation != null,
            pipe = listener.Pipe != null,
            mpvFound = Directory.Exists(mpvLocation),
            mpvScriptFound = File.Exists(script)
        };
    }
}