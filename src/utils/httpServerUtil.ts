import { getSetting } from "../core/Settings";

export async function getHttpServerAddress() {
    return `http://${await getSetting("serverAddress")}`
} 