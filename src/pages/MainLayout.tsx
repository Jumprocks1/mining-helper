import MhHeader from "../components/MhHeader"
import { LayoutType } from "../framework/PageComponent"

export default (({ children }) => [
    MhHeader(),
    <div id="body-container">
        {children}
    </div>
]) satisfies LayoutType
