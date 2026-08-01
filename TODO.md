# Bugs
- Shift on rec modal word tooltips wasn't working
    - Haven't reproduced yet, should attatch debugger next time
- Tooltip can flash like crazy if you hover a button border
    - Seems to be some sort of subpixel overlap, despite the anchor being set so there's no overlap

# High prio
- Prioritize enm subs?
- Some way of showing rarer kana vocab
- Rec modal tooltip requires a mouse movement
- Override jpdb id button when mining
    - 傷痕 in koori 8
    - Override word, audio, highlighting
    - 素性 Re:Zero ep 73, pulled the correct meaning + audio, but the furigana reading was wrong
        - Kind of seems like a JPDB bug, probably can't do anything
        - I also had to swap out the reading inside the sentence, should be doable
        - I think the reading for the vocab was wrong because we pull it from the sentence, and the JPDB sentence parsing was incorrect
- Hide .ass marker things? should try running .ass => .srt and see what ffmpeg does
    - These show up as a bunch of numbers currently. Need to find example
- `SETUP.md`
- Setup page - maybe we just get things released with a `SETUP.md`
    - Add more info for server check instructions
    - Add non-origin requiring server check
        - Make it like `/ping`, allow all origins
    - Full instructions
    - Validate buttons
    - ffmpeg, mpv, local audio database, API keys, mpv script, websocket, http
    - lib folder for ffmpeg
    - Setup flag
        - Move mpv script and set the exe location
        - Make sure we check each step to see if it's already set
    - Should make a nice system that takes delegate and checks stuff
        - Delegate should be able to easily return async progress as well as a final output error
        - Should use same delegates/functions for all validate/setup checks
- SetupMpv function not complete
- README has a TODO in it
- Make sure release has
    - setup.bat
    - README.txt

# GitHub build/release
- Make sure `setup.bat` works
- Make sure server comes with (empty) lib folder next to appsettings
- README.txt
    - Add a link to this file from the web client, maybe call it `SETUP.md` but then rename it to README.txt in the zip
- Add versioning to the server exe

# Before sharing
- Search for all TODOs
- SPA
    - Move Chrome API to separate file with a shim
    - I wonder if audio bytes/arraybuffer will be saveable in localstorage
- Add error messages when API key isn't set up
    - Way to configure API key, make it as easy as possible
- Make sure it works (with good errors) without different parts
    - server API key
    - missing audio files
- Demo videos

# Eventually
- Some way of selecting different English subs, was an issue for Guilty Crown
- Hotkeys for recommended modal - highlight current row, up/down to go to next vocab
    - Nice because we might be staring at mpv instead of looking where mouse is
- Linux/Mac instructions
- PWA
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

# Not really necessary
- Chapter filtering doesn't account for offset
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
