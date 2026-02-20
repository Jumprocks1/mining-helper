namespace MiningHelper;

public static class Setup
{
    public static void Run()
    {
        Program.Print("Starting first time setup", ConsoleColor.DarkGray);
        Program.Print("Welcome to Anki Mining Helper", ConsoleColor.Green);
        SetupMpv();
        SqliteSeeder.Setup();
    }
    public static void SetupMpv()
    {
        // TODO check for mpv and move script (same as ps1 script)
    }
}