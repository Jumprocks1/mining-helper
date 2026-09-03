# Setup
Eventually there will be guided setup instructions at https://jumprocks1.github.io/mining-helper/setup, but for now the instructions are listed here.

1. Download the [latest release](https://github.com/Jumprocks1/mining-helper/releases) - currently only Windows has official releases. To run on Linux/Mac, you'll have to run from source.
2. Run `setup.bat`. This will walk you through the server setup process.

TODO need to get the release working before I can fill this out

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