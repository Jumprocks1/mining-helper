let added = false

export default () => {
    if (added) return
    added = true
    const header = document.head
    const icons = [
        "close",
        "play_arrow",
        "search"
    ]
    const url = `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&icon_names=${icons.join(",")}`;
    header.append(<link rel="stylesheet" href={url} />)
}