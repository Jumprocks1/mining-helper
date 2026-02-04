using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json.Nodes;

namespace MiningHelper.Utils;

public static class AppSettings
{
    static JsonNode? _settings;
    public static JsonNode Settings => _settings ?? throw new Exception("Settings not loaded");
    public static string? LogPath { get; private set; }
    public static string? AllowOrigin { get; private set; }
    public static string? ApiKey { get; private set; }
    public static int Port { get; private set; } = 4012;

    public static string? SettingsFolder { get; private set; }

    public static T Get<T>(string key) => Settings[key]!.AsValue().GetValue<T>();
    public static T? GetOptional<T>(string key) => (Settings[key]?.AsValue().TryGetValue<T>(out var v) ?? false) ? v : default;
    public static string GetPath(string key) => Path.GetFullPath(Get<string>(key),
        SettingsFolder ?? throw new Exception("Settings not loaded"));
    public static string? GetOptionalPath(string key)
    {
        var path = GetOptional<string>(key);
        if (path == null) return null;
        return Path.GetFullPath(path, SettingsFolder ?? throw new Exception("Settings not loaded"));
    }
    public static void Load()
    {
        var settingsFile = new string[] {
            "appsettings.json",
            "../appsettings.json",
            Path.Join(Assembly.GetEntryAssembly()?.Location, "../appsettings.json"),
            Path.Join(Assembly.GetEntryAssembly()?.Location, "../../appsettings.json"),
            Path.Join(Assembly.GetEntryAssembly()?.Location, "../../../appsettings.json")
        };
        var found = settingsFile.FirstOrDefault(File.Exists)
            ?? throw new ExitException($"appsettings.json not found.\nPlease place it near {Assembly.GetEntryAssembly()?.Location}");

        _settings = JsonNode.Parse(File.ReadAllText(found));
        SettingsFolder = Path.GetDirectoryName(Path.GetFullPath(found));
        LogPath = GetPath("LogPath");
        AllowOrigin = Get<string>("AllowOrigin");
        Port = GetOptional<int?>("Port") ?? Port;

        var directory = Path.GetDirectoryName(found);
        var apiKeyFile = Path.Join(directory, "ApiKey.txt");
        if (File.Exists(apiKeyFile))
        {
            ApiKey = File.ReadAllText(apiKeyFile).Trim();
        }
        else
        {
            Console.WriteLine("Generating new API key");
            var apiKeyCharacters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            ApiKey = new string(RandomNumberGenerator.GetItems<char>(apiKeyCharacters, 32));
            File.WriteAllText(apiKeyFile, ApiKey);
        }
    }

    public static bool ShouldAllowOrigin(string? origin) => origin switch
    {
        "https://jpdb.io" => true,
        "https://jumprocks1.github.io" => true,
        _ => AllowOrigin != null && origin == AllowOrigin
    };
}