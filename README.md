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