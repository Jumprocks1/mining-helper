import LoadingButton from "../../components/LoadingButton";
import { OpenModal } from "../../components/Modal";
import Select from "../../components/Select";
import AnkiConnect from "../../utils/AnkiConnect";
import { ThrowUserError, userErrorMessage } from "../../utils/UserError";
import { AnkiFieldKey, AnkiFieldInfo, getSetting, setSetting, stringSettingsField } from "../../views/SettingsModal";

const body = async (inner: HTMLElement) => {
    const ankiFields = await getSetting("ankiFields")
    const fields: ReturnType<typeof Select>[] = []
    const fieldSelect = (key: AnkiFieldKey) => {
        const res = Select({
            defaultValue: ankiFields[key] ?? AnkiFieldInfo[key].name,
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
        <div className="field-group">
            {await stringSettingsField("ankiConnectAddress", "AnkiConnect Address", undefined,
                "Defaults to http://127.0.0.1:8765\nShouldn't need to be changed.\nThe correct value can be located in AnkiConnect's config.")}
            {await stringSettingsField("ankiConnectApiKey", "AnkiConnect API Key", "password")}
        </div>
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
    for (const _key in AnkiFieldInfo) {
        const key = _key as AnkiFieldKey
        const field = AnkiFieldInfo[key]
        fieldMappings.append(<div className="field" tooltip={field.tooltip}>
            <label>{field.name}</label>
            {fieldSelect(key)}
        </div>)
    }
    res.append(fieldMappings)
    const validateButton = <LoadingButton tooltip="This will attempt to connect to Anki and double check all settings." onClick={async () => {
        validateButton.tooltip = undefined
        let success = <div />
        try {
            const permissions = await AnkiConnect.call("requestPermission", undefined)
            if (permissions.permission === "denied") {
                throw `Access to AnkiConnect from ${location.origin} denied\n` +
                "Please check the AnkiConnect options inside Anki and ensure access is allowed."
            }
            const apiKey = await getSetting("ankiConnectApiKey")
            if (permissions.requireApikey && !apiKey)
                throw "An API key is required. Please add one in the settings above.\n\n" +
                "To find your current API key, in Anki, go to Tools > Add-ons > AnkiConnect > Config > apiKey"
        } catch (e) { throw userErrorMessage(e, "Error connecting to Anki") }
        const decks = await AnkiConnect.call("deckNames", undefined)
        if (decks.length === 0) ThrowUserError("No Anki decks found")
        success.append(<div>Found {decks.length} decks</div>)

        const models = await AnkiConnect.call("modelNames", undefined)
        const modelName = await getSetting("targetAnkiModel")
        if (!models.includes(modelName)) ThrowUserError(`${modelName} not found`)
        success.append(<div>Model '{modelName}' valid</div>)

        const modelFields = await AnkiConnect.call("modelFieldNames", { modelName })
        const ankiFields = await getSetting("ankiFields")
        let seen = new Set<string>()
        let invalidFields = 0
        for (const _key in AnkiFieldInfo) {
            const key = _key as AnkiFieldKey
            const field = AnkiFieldInfo[key]
            const current = ankiFields[key] ?? field.name
            if (current && seen.has(current)) throw `Field name ${current} used twice`
            seen.add(current)
            if (!current) {
                success.append(<div className="warning">Field {field.name} is unset</div>)
                invalidFields += 1
            } else if (!modelFields.includes(current)) {
                success.append(<div className="warning">Field {current} (used for {field.name}) does not exist in {modelName}</div>)
                invalidFields += 1
            }
        }
        if (invalidFields === 0)
            success.append(<div>All fields valid</div>)

        if (!success.querySelector(".warning")) {
            success.append(<div className="success">No issues found</div>)
        }

        validateButton.tooltip = success
    }}>
        Validate Settings
    </LoadingButton>
    inner.append(<div className="footer">{validateButton}</div>)
    return res
}

export default () => OpenModal({
    className: "settings-modal",
    body,
    header: "Configuring AnkiConnect"
})