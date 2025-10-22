import { PlayableAudio, playAudio } from "../utils/Audio"

interface Props {
    audio: PlayableAudio
    name: string // not super important, prevents duplicates
}
export default ({ name, audio }: Props) => {
    const o = <span className="play-icon icon-button material-symbols-outlined">play_arrow</span>
    o.addEventListener("click", async () => {
        playAudio(name, audio)
    })
    return o
}