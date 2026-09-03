namespace MiningHelper.Setup;

public static partial class Setup
{
    public static void SetupMpv()
    {
        const string scriptName = "mining_helper.lua";

        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var mpvPath = Path.Join(appData, "mpv");

        if (!Directory.Exists(mpvPath))
        {
            Program.Print("Failed to locate mpv script directory", color: ConsoleColor.Yellow);
            Program.Print($"mpv integration features will not function if {scriptName} is not installed");
            Program.Print("To install mpv, see https://mpv.io/installation");
            Program.Print("To manually configure mpv for use with Mining Helper, see https://github.com/Jumprocks1/mining-helper/blob/main/docs/SETUP.md#mpv");
            return;
        }

        var scriptOutputPath = Path.Join(mpvPath, "scripts", scriptName);
        if (File.Exists(scriptOutputPath))
        {
            Program.Print($"{scriptName} already installed", color: ConsoleColor.DarkGray);
            return;
        }
        var self = System.Reflection.Assembly.GetEntryAssembly()?.Location;
        if (self == null)
        {
            Program.Print("Failed to locate assembly", color: ConsoleColor.Red);
            return;
        }

        var binFolder = Path.GetDirectoryName(self);
        var sourceFileLocations = new string?[] {
            binFolder,
            Path.Join(binFolder, "scripts"),
            Path.Join(binFolder, "..", "scripts"),
            Path.Join(binFolder, "..", "..", "scripts"),
            Path.Join(binFolder, "..", "..", "..", "scripts"),
            Path.Join(binFolder, "..", "..", "..", "..", "scripts"),
            Path.Join(binFolder, "..", "..", "..", "..", "..", "scripts"),
        };
        string? sourceFile = null;
        foreach (var e in sourceFileLocations)
        {
            if (e == null) continue;
            var path = Path.Join(e, scriptName);
            if (File.Exists(path))
            {
                sourceFile = path;
                break;
            }
        }
        if (sourceFile == null)
        {
            Program.Print($"Failed to locate {scriptName}", color: ConsoleColor.Red);
            Program.Print("To manually configure mpv see https://github.com/Jumprocks1/mining-helper/blob/main/docs/SETUP.md#mpv");
            return;
        }

        var exeNames = new string[] { "MiningHelper.exe", "MiningHelper" };
        string? foundExePath = null;
        foreach (var e in exeNames)
        {
            var exePath = Path.Join(binFolder, e);
            if (File.Exists(exePath))
            {
                foundExePath = exePath;
                break;
            }
        }
        if (foundExePath == null) throw new Exception("Failed to locate MiningHelper.exe");
        foundExePath = foundExePath.Replace('\\', '/');

        Program.Print($"Would you like to copy {scriptName} to {scriptOutputPath}?", ConsoleColor.Cyan, newLine: false);
        Program.Print(" (yes/no): ", newLine: false);
        if (ReadYes(true))
        {
            Directory.CreateDirectory(Path.GetDirectoryName(scriptOutputPath)!);
            var contents = File.ReadAllText(sourceFile).Replace("@EXECUTABLE_PATH", foundExePath);
            File.WriteAllText(scriptOutputPath, contents);
            Program.Print($"{scriptName} installed. Boot mpv and press Ctrl+d to make sure it works.", color: ConsoleColor.Green);
            Program.Print("You can configure the keybind in the script file.");
        }
    }
}