import { stringSettingsField } from "./SettingsModal";

export async function AnkiConnectSettingsFields() {
    return [
        await stringSettingsField("ankiConnectAddress", "AnkiConnect Address"),
        await stringSettingsField("ankiConnectApiKey", "AnkiConnect API Key", "password"),
    ]
}