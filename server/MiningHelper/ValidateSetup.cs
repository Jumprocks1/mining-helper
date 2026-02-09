using MiningHelper.Utils;

namespace MiningHelper;

public static class ValidateSetup
{
    public static async Task<object> Validate()
    {
        return new
        {
            ffmpegFound = FfmpegUtil.FfmpegLocation != null,
            connected = true
        };
    }
}