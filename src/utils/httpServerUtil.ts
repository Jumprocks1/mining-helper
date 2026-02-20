import { getSetting } from "../views/SettingsModal";

export async function getHttpServerAddress() {
    return `http://${await getSetting("serverAddress")}`
} 