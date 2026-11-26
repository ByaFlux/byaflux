import { fetchRemoteCatalog } from "./remote";
const API = "https://byaflux.discloud.dev";

export async function fetchProfile(_: unknown, userId: string): Promise<unknown> {
  if (!/^\d{17,20}$/.test(userId)) throw new Error("Perfil inválido");
  return fetchRemoteCatalog(`${API}/api/client/profiles/${userId}/badges`);
}

export async function reportOpen(_: unknown, version: string): Promise<void> {
  const platform =
    process.platform === "win32" ? "windows" : process.platform === "linux" ? "linux" : null;
  if (!platform) return;
  const response = await fetch(`${API}/api/client/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform, version: String(version).slice(0, 40) || "unknown" }),
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`ByaFlux API: HTTP ${response.status}`);
}

export {
  getEditorProfile,
  beginLayoutConnection,
  checkLayoutConnection,
  saveProfileLayout,
  resetProfileLayout,
  disconnectProfileLayout,
  cancelLayoutConnection,
} from "./layout-native";
