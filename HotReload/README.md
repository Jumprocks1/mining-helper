This is a small server for serving CSS changes to the client. Only used if `-HotReloadCss` is passed to `Watch.ps1`.

I'm sure there's better alternatives, but this works quite well.
Currently the changes are reflected in ~300ms, most of which is taken up by the SASS compiler.

This doesn't reload anything for JS changes since those would require a full page reload and I find that annoying.