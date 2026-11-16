import { BADGES_URL } from "./generated";
import { fetchRemoteCatalog } from "./remote";

export async function fetchCatalog(_: unknown): Promise<unknown> {
    return fetchRemoteCatalog(BADGES_URL);
}
