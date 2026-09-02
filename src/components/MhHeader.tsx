declare var GITHUB_PAGES: boolean | undefined

export default () => {
    return <div id="mh-header">
        <a className="button home" id="title" href="home.html">Mining Helper</a>
        <a className="button subs" href="subtitles.html">Subs</a>
        <a className="button anki" href="anki.html">Anki</a>
        <a className="button kanji" href="kanji.html">Kanji</a>
        {!GITHUB_PAGES && <a className="button ss" href="ss.html">Sentences</a>}
        <a className="button setup-link" href="setup.html">Setup</a>
    </div>
}