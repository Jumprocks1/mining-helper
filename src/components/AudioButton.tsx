import { PlayableAudio, playAudio } from "../utils/Audio"
import IconButton from "./basic/IconButton"

interface Props {
    audio: PlayableAudio
    name: string // not super important, prevents duplicates
}
export default ({ name, audio }: Props) => {
    return <IconButton className="play-icon" icon="play_arrow" onClick={() => playAudio(name, audio)} />
}