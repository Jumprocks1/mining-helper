chrome.storage.session.setAccessLevel({
    accessLevel: chrome.storage.AccessLevel.TRUSTED_AND_UNTRUSTED_CONTEXTS
});

chrome.runtime.onMessage.addListener(message => {
    if (message.startsWith("open:")) {
        chrome.tabs.create({ url: message.substring(5) })
    }
});

chrome.action.onClicked.addListener(async () => {
    const url = chrome.runtime.getURL("/subtitles.html");
    const tabs = await chrome.tabs.query({ url })

    if (tabs.length > 0) {
        await chrome.windows.update(tabs[0].windowId, { focused: true });
        await chrome.tabs.update(tabs[0].id, { active: true });
    } else {
        await chrome.tabs.create({ url })
    }
})