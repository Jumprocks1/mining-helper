# Setup
Eventually there will be guided setup instructions at https://jumprocks1.github.io/mining-helper/setup, but for now the instructions are listed here.

1. Download the [latest release](https://github.com/Jumprocks1/mining-helper/releases) - currently only Windows has official releases. To run on Linux/Mac, you'll have to run from source. Unzip the .zip file.
2. Run `setup.bat`. This will walk you through the server setup process.
    - The first step is adding a script to mpv that allows mpv to communicate with the Mining Helper web interface.
    - The second step is downloading dictionary files for creating kanji cards in Anki.
    - The third step is for setting up a local audio database. This provides audio for vocab mined from mpv. Note, the full sentence audio will come from the media file, the local audio database is only needed for the single vocab word audio.
3. Open mpv and start the server by pressing <kbd>Ctrl</kbd>+<kbd>d</kbd>
4. Open the [web interface](https://jumprocks1.github.io/mining-helper/subtitles)
5. Open the settings by clicking the gear in the top right or by pressing (<kbd>,</kbd>)
6. There should now be a file labeled `ApiKey.txt` in the folder from step 1. Copy the contents of that file into the "Server API Key" settings field.
7. TODO - need to add steps for configuring jpdb + Anki fields

## Running as a Chrome Extension
There are a few extra features when running as a Chrome extension (instead of a website). I don't expect this to be necessary for most, but here's the instructions:

1. Install Node.js
2. Run `npm i` to install TS + esbuild
3. Run `node esbuild.mjs` to build
4. Load `dist` as an unpacked Chrome extension through `chrome://extensions`
5. Complete other setup instructions (mpv, server, jpdb)

It should also work as a Firefox extension with some minor modifications, though I haven't tested it yet.

# Manual Setup
If you prefer a more manual setup or are curious how everything works, you can follow the instructions here.

## mpv
1. Install [mpv](https://mpv.io/installation/)
2. Copy [mining_helper.lua](https://github.com/Jumprocks1/mining-helper/blob/main/scripts/mining_helper.lua) into your mpv scripts directory
    - On Windows, this is at `%appdata%/mpv/scripts`
3. Replace `@EXECUTABLE_PATH` in the first line with the path to MiningHelper.exe from the GitHub release zip folder.
    - For example, `local executablePath = "F:/jp/mining-helper-win-x64/bin/MiningHelper.exe"`
4. Optionally, replace `local toggleServerKeybind = "Ctrl+d"` with the keybind you want to use to boot the server
5. Start mpv and press the configured keybind (`Ctrl+d`). You should see a command window open as well as `Mining server started`
    - While that command window is open, the Mining Helper web interface should be able to communicate with mpv.