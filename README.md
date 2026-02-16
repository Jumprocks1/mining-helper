# Anki Mining Helper
This is a collection of tools for mining Anki cards from media viewed through mpv.

## Setup Guide
Go to https://jumprocks1.github.io/mining-helper/setup - this will guide you through the setup process.

Here's a rough outline of what it will help you set up:

1. Set up background server - this bridges communication from mpv <=> web interface. It only runs when manually started.
2. Add mpv script for launching the background server when requested
3. Add hotkey to mpv for launching the background server
4. Download local word audio database (not needed if you prefer Yomitan for word audio)
5. Configure AnkiConnect + Anki field mappings
6. Add jpdb API key
7. Ensure `ffmpeg` is installed and in the system path

### TODO
- Actually add that setup page

## Advantages over existing tools
- Doesn't rely on mpv for parsing the subtitles, allowing it to load the entire subtitle file at once
- Doesn't use the clipboard for transferring subtitles
- Recommends the most frequently used words that you haven't mined yet
- Easy to mine after finishing the content (without pausing to mine)

## Related projects
- https://yomitan.wiki/ - not required since the site parses subtitles with jpdb
- https://docs.asbplayer.dev/docs/intro - similar, but works with online video players instead of mpv
- https://github.com/kuroahna/mpv_websocket - similar, works with mpv but with less features

## Missing Features
I plan to add these eventually. Please open a [GitHub issue](https://github.com/Jumprocks1/mining-helper/issues) if you have ideas or suggestions on how to implement these features.

- Pitch accent mining
    - jpdb has this info in their api, but I haven't tried pulling it yet
- Yomitan integration
    - I don't currently use Yomitan, but I imagine there's some useful integrations that would make things smoother for those who do use it.

See also [TODO.md](TODO.md) for more things I have planned. That's my personal TODO list for the project, so don't take it too seriously.