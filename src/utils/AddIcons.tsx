import "./createElement" // probably possible to not have to do this but couldn't figure it out

let added = false

// https://fonts.google.com/icons
// must be alphabetical
export const MaterialIcons = [
    "close",
    "delete",
    "error",
    "maximize",
    "menu",
    "minimize",
    "play_arrow",
    "refresh",
    "restore_from_trash",
    "search",
    "settings",
    "star",
    "stat_1",
    "stat_minus_1"
] as const satisfies string[]

export default () => {
    if (added) return
    added = true
    const header = document.head
    const url = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=${MaterialIcons.join(",")}`;
    header.append(<link rel="stylesheet" href={url} />)
}