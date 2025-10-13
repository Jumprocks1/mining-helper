chrome.storage.session.setAccessLevel({
    accessLevel: chrome.storage.AccessLevel.TRUSTED_AND_UNTRUSTED_CONTEXTS
});

chrome.runtime.onMessage.addListener(message => {
    if (message.startsWith("open:")) {
        chrome.tabs.create({ url: message.substring(5) })
    }
});