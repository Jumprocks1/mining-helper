This contains the C# code for running the background server that communicates between mpv and the web interface.

# Key features
- Forward action requests to mpv (seek, pause, show subtitles)
- Report mpv playback position to web interface
- Extract subtitles from currently playing media (and send to web interface)
- Extract audio from current media (and send to web interface)
- Extract images from current media (and send to web interface)
- Host audio for native readings of most Japanese vocabulary