import AnkiPage from "../anki/anki";
import { type Pages } from "../framework/Router";
import HomePage from "./home/home";
import SentenceSearchPage from "./ss/ss";
import SubtitlesPage from "./subtitles/subtitles";


// we keep this as a keyed object (not array) so we can reference them in link buttons
export default {
    // by putting the routes here, we avoid having to deal with static members on the pages
    // it's also nice to be able to see all the routes in one place
    home: { path: "/home", pathMatch: route => route === "/", component: HomePage },
    sentences: { path: "/ss", component: SentenceSearchPage },
    subtitles: { path: "/subtitles", component: SubtitlesPage },
    anki: { path: "/anki", component: AnkiPage },
} satisfies Pages