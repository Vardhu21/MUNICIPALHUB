import { common } from "./common";
import { pages } from "./pages";

export type Phrase = { en: string; ta: string };
export type Locale = Record<string, Phrase>;

/** Merged translation resources. Add new namespaces as separate files. */
export const RESOURCES: Locale = { ...common, ...pages };
