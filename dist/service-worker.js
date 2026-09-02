if (!browser) browser = chrome

browser.storage.session.setAccessLevel({
    accessLevel: browser.storage.AccessLevel.TRUSTED_AND_UNTRUSTED_CONTEXTS
});

browser.runtime.onMessage.addListener(message => {
    if (message.startsWith("open:")) {
        browser.tabs.create({ url: message.substring(5) })
    }
});

browser.action.onClicked.addListener(async () => {
    const url = browser.runtime.getURL("/subtitles.html");
    const tabs = await browser.tabs.query({ url })

    if (tabs.length > 0) {
        await browser.windows.update(tabs[0].windowId, { focused: true });
        await browser.tabs.update(tabs[0].id, { active: true });
    } else {
        await browser.tabs.create({ url })
    }
})