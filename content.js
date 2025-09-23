const style = `
`
const script = document.createElement('script');
script.src = chrome.runtime.getURL("/inject.js");
document.documentElement.prepend(script)
const css = document.createElement("style")
css.innerHTML = style
document.documentElement.prepend(css)