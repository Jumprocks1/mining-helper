import MhHeader from "../components/MhHeader"
import { LayoutType } from "../framework/PageComponent"

export default (({ children }) => [
    MhHeader(),
    <main id="body-container">
        {children}
    </main>
]) satisfies LayoutType
