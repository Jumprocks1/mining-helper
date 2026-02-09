using MiningHelper.Utils;

namespace MiningHelper;

public static class ValidateSetup
{
    public static async Task<object> Validate(InputListener listener)
    {
        return new
        {
            ffmpegFound = FfmpegUtil.FfmpegLocation != null,
            connected = true,
            pipe = listener.Pipe != null
        };
    }
}