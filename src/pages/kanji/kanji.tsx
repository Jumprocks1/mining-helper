import Loader from "../../components/Loader"
import { Children } from "../../framework/createElement"
import { PageComponent } from "../../framework/PageComponent"

const deckName = "Mining Helper Kanji"

export default class KanjiPage extends PageComponent {
    Id = "kanji-page"
    override Title = "Mining Helper - Kanji"
    Node: Children
    constructor() {
        super()
        this.Node = <Loader load={main} />
    }
}


const main = async () => {
    return <div>
        test
    </div>
}