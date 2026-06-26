import LoadingButton from "../../components/LoadingButton";
import { OpenModal } from "../../components/Modal";
import Select from "../../components/Select";
import AnkiConnect from "../../utils/AnkiConnect";
import SettingsValidator from "../../utils/SettingsValidator";
import { userErrorMessage, userErrorMessage2 } from "../../utils/UserError";
import { AnkiFieldKey, AnkiFieldInfo, getSetting, setSetting, stringSettingsField } from "../../views/SettingsModal";

async function validateAnkiSettings(validator: SettingsValidator) {
    try {
        const permissions = await AnkiConnect.call("requestPermission", undefined)
        if (permissions.permission === "denied") {
            throw userErrorMessage2(`Access to AnkiConnect from ${location.origin} denied`,
                "Please check the AnkiConnect options inside Anki and ensure access is allowed.")
        }
        const apiKey = await getSetting("ankiConnectApiKey")
        if (permissions.requireApikey && !apiKey)
            throw userErrorMessage2("An API key is required. Please add one in the settings above.",
                "To find your current API key, in Anki, go to Tools > Add-ons > AnkiConnect > Config > apiKey")
    } catch (e) {
        if (e instanceof Error) throw userErrorMessage(e, "Error connecting to Anki")
        else throw e
    }
    const decks = await AnkiConnect.call("deckNames", undefined)
    if (decks.length === 0) throw "No Anki decks found"
    validator.Pass(`Found ${decks.length} decks`)

    const deckName = await getSetting("targetAnkiDeck")
    if (!decks.includes(deckName)) throw `Deck '${deckName}' not found`
    let notes = await AnkiConnect.call("findNotes", { query: `"deck:${deckName}"` })
    if (notes.length === 0)
        validator.Warn(`No notes found in '${deckName}'`)
    else
        validator.Pass(`Found ${notes.length} notes in '${deckName}'`)

    const models = await AnkiConnect.call("modelNames", undefined)
    const modelName = await getSetting("targetAnkiModel")
    if (!models.includes(modelName)) throw `Model '${modelName}' not found`

    notes = await AnkiConnect.call("findNotes", { query: `"deck:${deckName}" "note:${modelName}"` })
    if (notes.length === 0)
        validator.Warn(`No notes with type '${modelName}'`)
    else
        validator.Pass(`Found ${notes.length} notes with type '${modelName}'`)

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
            validator.Warn(`Field ${field.name} is unset`)
            invalidFields += 1
        } else if (!modelFields.includes(current)) {
            validator.Warn(`Field ${current} (used for ${field.name}) does not exist in ${modelName}`)
            invalidFields += 1
        }
    }
    if (invalidFields === 0)
        validator.Pass("All fields valid")

    if (!validator.HasWarnings) validator.SuccessMessage("No issues found")
}

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
        const validator = new SettingsValidator()
        validator.ShowLoading = true
        validateButton.tooltip = validator.Node
        await validator.Test(validateAnkiSettings)
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