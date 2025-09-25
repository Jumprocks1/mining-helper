const style = `
`

let zip = null;

(async () => {
    const src = chrome.runtime.getURL("/zip-core.min.js");
    zip = await import(src);
})();

const target = document.head || document.documentElement

const css = document.createElement("style")
css.innerHTML = style
target.prepend(css)

document.addEventListener("sentence-selected", e => {
    const detail = e.detail
    console.log(detail)


    // const zipFileWriter = new zip.BlobWriter();
    // const zipWriter = new zip.ZipWriter(zipFileWriter);

    // const audioBytes = (await fetches[audio])[0]
    // const sentenceAudioBytes = (await fetches[sentenceAudio])[0]

    // if (audioBytes)
    //     await zipWriter.add(audioLocalFile, new zip.BlobReader(new Blob([audioBytes])))
    // else console.error(`audio not found ${audio}`)
    // if (sentenceAudioBytes)
    //     await zipWriter.add(sentenceAudioLocalFile, new zip.BlobReader(new Blob([sentenceAudioBytes])))
    // else console.error(`sentence audio not found ${audio}`)

    // await zipWriter.close();
    // await downloadBlob(await zipFileWriter.getData(), "jpdb.zip")
})