import MhHeader from "../components/MhHeader"
import { LayoutProps } from "../framework/Page"

export default ({ page }: LayoutProps) => [
    MhHeader(),
    <div id="body-container">
        {page.Node}
    </div>
]
