import { common } from "./common";
import { pages } from "./pages";
import { groupa } from "./group-a";
import { groupb } from "./group-b";
import { groupc } from "./group-c";
import { groupd } from "./group-d";

export type Phrase = { en: string; ta: string };
export type Locale = Record<string, Phrase>;

/** Merged translation resources. Add new namespaces as separate files. */
export const RESOURCES: Locale = { ...common, ...pages, ...groupa, ...groupb, ...groupc, ...groupd };
