import { Icon } from "../components/basic/IconButton"
import { getSetting, setSetting } from "./SettingsModal"

export const JpdbApiKeyField = async () => <div className="field jpdb-key-field">
    <label>jpdb API Key
        {" "}
        <Icon icon="help"
            component="a"
            componentProps={{
                href: "https://jpdb.io/settings",
                target: "_blank",
                rel: "noopener noreferrer"
            }}
            className="inline"
            tooltip={"You can get one from the very bottom of the jpdb.io settings page.\nAn account is required, but only a username/password is needed.\nClick to open jpdb.io"} /></label>
    <input type="password" defaultValue={await getSetting("jpdbApiKey")}
        onchange={e => setSetting("jpdbApiKey", (e.target as HTMLInputElement).value)} />
</div>