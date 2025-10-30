let added = false

// https://fonts.google.com/icons
// must be alphabetical
export const MaterialIcons = [
    "close",
    "play_arrow",
    "search",
    "settings"
] as const satisfies string[]

export default () => {
    if (added) return
    added = true
    const header = document.head
    const url = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=${MaterialIcons.join(",")}`;
    header.append(<link rel="stylesheet" href={url} />)
}