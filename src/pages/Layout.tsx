import MhHeader from "../components/MhHeader"
import { LayoutProps } from "../framework/Page"

export default ({ children }: LayoutProps) => [
    MhHeader(),
    <div id="body-container">
        {children}
    </div>
]
