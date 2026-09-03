using System.Reflection;
using System.Security.Cryptography;
using System.Text.Json.Nodes;

namespace MiningHelper.Utils;

public static class AppSettings
{
    static JsonObject? _settings;
    public static JsonObject Settings => _settings ?? throw new Exception("Settings not loaded");
    public static string? LogPath { get; private set; }
    public static string? AllowOrigin { get; private set; }
    public static string? ApiKey { get; private set; }
    public static int Port { get; private set; } = 4012;

    public static string SettingsFolder { get => field ?? throw new Exception("Settings not loaded"); private set; }

    public static T Get<T>(string key) => (Settings[key] ?? throw new Exception($"Setting key '{key}' not found")).AsValue().GetValue<T>();
    public static T? GetOptional<T>(string key) => (Settings[key]?.AsValue().TryGetValue<T>(out var v) ?? false) ? v : default;
    public static string GetPath(string key) => Path.GetFullPath(Get<string>(key),
        SettingsFolder);
    public static string? GetOptionalPath(string key)
    {
        var path = GetOptional<string>(key);
        if (path == null) return null;
        return Path.GetFullPath(path, SettingsFolder ?? throw new Exception("Settings not loaded"));
    }


    public static void MergeNodes(JsonObject baseNode, JsonObject overrideNode)
    {
        foreach (var property in overrideNode)
        {
            var key = property.Key;
            var overrideValue = property.Value;
            if (baseNode.TryGetPropertyValue(key, out var _bV) && _bV is JsonObject bV && property.Value is JsonObject oV)
                MergeNodes(bV, oV);
            else
                baseNode[key] = overrideValue?.DeepClone();
        }
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

        _settings = (JsonObject?)JsonNode.Parse(File.ReadAllText(found)) ?? throw new Exception("Settings null");
        SettingsFolder = Path.GetDirectoryName(Path.GetFullPath(found))!;

        var local = Path.Join(SettingsFolder, "appsettings.Local.json");
        if (File.Exists(local))
        {
            var localOverrides = (JsonObject?)JsonNode.Parse(File.ReadAllText(local))
                ?? throw new Exception("Override settings null");
            MergeNodes(_settings, localOverrides);
        }

        LogPath = GetPath("LogPath");
        AllowOrigin = GetOptional<string>("AllowOrigin");
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

    public static FileStream OpenRead(string path)
    {
        path = Path.GetFullPath(path, SettingsFolder);
        if (!File.Exists(path)) throw new UserException($"{path} not found");
        return File.OpenRead(path);
    }

    public static string KanjiDicPath => GetFullPath("sources/kanjidic2.xml.gz");
    public static string KradFilePath => GetFullPath("sources/kradfile.gz");
    public static string GetFullPath(string path) => Path.GetFullPath(path, SettingsFolder);
}