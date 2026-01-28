import LoadingButton from "../../components/LoadingButton";
import { OpenModal } from "../../components/Modal";
import Select from "../../components/Select";
import AnkiConnect from "../../utils/AnkiConnect";
import { delay } from "../../utils/util";
import { getSetting, setSetting, stringSettingsField } from "../../views/SettingsModal";

const body = async (inner: HTMLElement) => {
    // JSX doesn't work with this component
    // TODO need to add more of these
    // Eventually they need to save to a shared object
    const fieldSelect = Select({
        defaultValue: "",
        includeEmpty: true,
        loadOptions: async () => AnkiConnect.call("modelFieldNames", { modelName: await getSetting("targetAnkiModel") })
    })
    // Needs a button for checking everything. Check:
    //   API key
    //   Duplicate field names
    //   Unset important fields
    //   Set fields that don't exist on the current model
    // Needs a button for auto mapping, will auto press itself if nothing is set yet
    const res = <>
        {await stringSettingsField("ankiConnectAddress", "AnkiConnect Address")}
        {await stringSettingsField("ankiConnectApiKey", "AnkiConnect API Key", "password")}
        <div className="field-group">
            <div className="field">
                <label>Taget Deck</label>
                {Select({
                    defaultValue: await getSetting("targetAnkiDeck"),
                    loadOptions: () => AnkiConnect.call("deckNames", undefined),
                    onChange: v => setSetting("targetAnkiDeck", v)
                })}
            </div>
            <div className="field">
                <label>Target Model</label>
                {Select({
                    defaultValue: await getSetting("targetAnkiModel"),
                    loadOptions: () => AnkiConnect.call("modelNames", undefined),
                    onChange: v => {
                        setSetting("targetAnkiModel", v)
                        fieldSelect.Reset?.()
                    }
                })}
            </div>
        </div>
        <div className="field-group">
            <div className="field">
                <label>Word Field *TODO*</label>
                {fieldSelect}
            </div>
        </div>
    </>
    inner.append(<div className="footer">
        <LoadingButton onClick={async () => {
            await delay(1000)
            throw "TODO this isn't set up yet"
        }}>
            Verify Settings
        </LoadingButton>
    </div>)
    return res
}

export default () => OpenModal({
    className: "settings-modal",
    body,
    header: "Configuring AnkiConnect"
})