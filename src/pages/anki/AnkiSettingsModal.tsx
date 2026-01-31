import LoadingButton from "../../components/LoadingButton";
import { OpenModal } from "../../components/Modal";
import Select from "../../components/Select";
import AnkiConnect from "../../utils/AnkiConnect";
import { delay } from "../../utils/util";
import { AnkiFieldKey, AnkiFieldsDefaults as AnkiFieldDefaults, getSetting, setSetting, stringSettingsField } from "../../views/SettingsModal";

const body = async (inner: HTMLElement) => {
    const ankiFields = await getSetting("ankiFields")
    const fields: ReturnType<typeof Select>[] = []
    const fieldSelect = (key: AnkiFieldKey) => {
        const res = Select({
            defaultValue: ankiFields[key] ?? AnkiFieldDefaults[key],
            includeEmpty: true,
            loadOptions: async () => AnkiConnect.call("modelFieldNames", { modelName: await getSetting("targetAnkiModel") }),
            onChange: v => {
                ankiFields[key] = v
                // TODO we set these but don't use them anywhere
                setSetting("ankiFields", ankiFields) // not awaited
            }
        })
        fields.push(res)
        return res
    }
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
                        fields.forEach(e => e.Reset?.())
                    }
                })}
            </div>
        </div>
        <h3>Field Mappings</h3>
    </>
    const fieldMappings = <div className="anki-field-mappings" />
    for (const _key in AnkiFieldDefaults) {
        const key = _key as AnkiFieldKey
        const fieldName = AnkiFieldDefaults[key]
        fieldMappings.append(<div className="field">
            <label>{fieldName}</label>
            {fieldSelect(key)}
        </div>)
    }
    res.append(fieldMappings)
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