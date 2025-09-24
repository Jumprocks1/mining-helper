const style = `
`

const target = document.head || document.documentElement

// this is slightly delayed in loading, but that's fine
// I tried loading this with manifest content script but it didn't work when actually called
const zipScript = document.createElement('script');
zipScript.src = chrome.runtime.getURL("/zip-core.min.js");
target.prepend(zipScript)

const css = document.createElement("style")
css.innerHTML = style
target.prepend(css)