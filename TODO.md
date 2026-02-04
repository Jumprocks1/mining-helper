# Bugs
- Shift on rec modal word tooltips wasn't working
    - Haven't reproduced yet, should attatch debugger next time

# High prio
- Add validate button to subs settings modal
    - Check for mpv/ffmpeg, local audio
- Setup page
    - Full instructions
    - Validate buttons
    - ffmpeg, mpv, local audio database, API keys, mpv script, websocket, http
    - lib folder for ffmpeg
- Setup flag
    - Move mpv script and set the exe location
    - Make sure we check each step to see if it's already set

# Before publishing/sharing
- SPA
    - Move Chrome API to separate file with a shim
    - I wonder if audio bytes/arraybuffer will be saveable in localstorage
- Add error messages when API key isn't set up
    - Way to configure API key, make it as easy as possible
- Make sure C# log doesn't increase infinitely
- Move mpv script into repo
- Fix hard-coded path to server exe in mpv script
- Make sure it works (with good errors) without different parts
    - jpdb API key
    - `T` jpdb thing
    - put message in mpv when you start server
    - server API key
    - missing audio files
- Don't allow arbitrary ipc

# Eventually
- Some way to force a different JPDB token
    - 意地でも vs 意地
    - 日本語字幕 - Japanese Subtitles - AssClass S01E10 - 18m
- Automatic Anki field config based on aliases
- Add `i` icons with no tooltip delay where needed
- Changing offset requeries chapter list, should cache it or something
- Multi highlight - no support in tokensToFuri sadly
    - If a line has multiple instances of the target vocab, all are highlighted in main view, but furigana view only has first
- Options to disable features like the shift hover
- Clean up MiningModal code, getting a bit messy
- When selecting, tell user they can press buttons to lookup
- Pitch accent mining
- Furigana above word in regular sub view
- Add editing for kanji/furigana in mining modal
- Option to ignore kanji when looking up readings
    - Had issues with 兄[きょう]妹[だい]. There is good audio for 兄弟, but not 兄妹
    - Probably add advanced search modal, let you enter whatever you want for audio
- Temporary ignore in recommended list, mainly for names
    - Without this, N+1 isn't as good since it won't include sentences with names

# Not really necessary
- Built in video player so mpv isn't technically needed? Probably not since anyone with the media files would have mpv
- Hook into other video sites like asbplayer does
- Option to filter out words with no good audio readings
- Trim prefixes/suffixes (sama, san) (when kana trim is enabled)
- Jimaku API https://jimaku.cc/api/docs
- Option to load jpdb machine translation in mining modal
- Hover top of mpv with mouse to show subs or something - saw this in different script
- Ability to update cards with mining modal
    - I could see myself finding better example sentences that I want to replace my existing cards with, but without losing the review history
- Might not need API key if we trust the origin fully, could be a config option on the C# side "trust origin without API key"
- Add grouping settings + RegEx options to source tree view
    - Make RegEx options reusable (for source replacement + subtitle stuff)
- Stop using ffmpeg to convert .ass on the server side
- There's some sketchiness with loading stuff while other promises are pending, this should be very rare in real use cases since the loading times are ~1s and no normal person will press other buttons/load other files during that time
- Filter out OP/ED layers from .ass subtitles - .srt aren't fancy enough for this
- Custom time filtering
    - I've been manually doing this for things like movies where I might mine halfway through (but don't want to accidentally skip to the second half)

# After publishing
- Contact https://animecards.site/

# Sources
- `all_v11.json` - https://sentencesearch.neocities.org/data/all_v11.json
- `yomitan_ultimate_audio_source.zip`
