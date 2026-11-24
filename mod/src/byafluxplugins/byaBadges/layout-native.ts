import { NativeSettings } from "@main/settings";
import { createHash, randomBytes } from "node:crypto";
import { safeStorage, shell } from "electron";
const API = "https://byaflux.discloud.dev";
type Secret = { value: string; encrypted: boolean };
const pending = new Map<string, { requestId: string; verifier: string; expiresAt: number }>();
function validUser(id: string) {
  if (!/^\d{17,20}$/.test(id)) throw new Error("Perfil inválido.");
}
function secrets(): Record<string, Secret> {
  const settings = (NativeSettings.store.plugins.ByaBadges ??= {});
  return (settings.badgeLayoutTokens ??= {});
}
function token(userId: string): string | undefined {
  const secret = secrets()[userId];
  if (!secret) return;
  try {
    return secret.encrypted
      ? safeStorage.decryptString(Buffer.from(secret.value, "base64"))
      : secret.value;
  } catch {
    delete secrets()[userId];
  }
}
async function request(path: string, method = "GET", body?: unknown, bearer?: string) {
  const response = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  if (text.length > 2 * 1024 * 1024) throw new Error("Resposta da API muito grande.");
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Atualize a API do ByaFlux para usar este painel.");
  }
  if (!response.ok)
    throw Object.assign(new Error(data.error || `ByaFlux API: HTTP ${response.status}`), {
      status: response.status,
    });
  return data;
}
export async function getEditorProfile(_: unknown, userId: string) {
  validUser(userId);
  const bearer = token(userId);
  if (!bearer)
    return { connected: false, ...(await request(`/api/client/profiles/${userId}/badges`)) };
  try {
    const profile = await request("/api/client/badge-layout/me", "GET", undefined, bearer);
    if (profile.profileId !== userId)
      throw Object.assign(new Error("Confirme a conta correta."), { status: 401 });
    return { connected: true, ...profile };
  } catch (error) {
    if ((error as any).status === 401) {
      delete secrets()[userId];
      return { connected: false, ...(await request(`/api/client/profiles/${userId}/badges`)) };
    }
    throw error;
  }
}
export async function beginLayoutConnection(_: unknown, userId: string) {
  validUser(userId);
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("hex");
  const result = await request("/api/client/badge-layout/link", "POST", { userId, challenge });
  if (!/^[A-Za-z0-9_-]{43}$/.test(result.requestId))
    throw new Error("Resposta de conexão inválida.");
  pending.set(userId, { requestId: result.requestId, verifier, expiresAt: result.expiresAt });
  await shell.openExternal(`${API}/badges/connect?request=${encodeURIComponent(result.requestId)}`);
  return { code: result.code, expiresAt: result.expiresAt };
}
export async function checkLayoutConnection(_: unknown, userId: string) {
  validUser(userId);
  const link = pending.get(userId);
  if (!link || link.expiresAt < Date.now())
    throw new Error("A conexão expirou. Confirme novamente.");
  const result = await request(`/api/client/badge-layout/link/${link.requestId}`, "POST", {
    verifier: link.verifier,
  });
  if (result.pending) return { pending: true };
  if (
    result.profileId !== userId ||
    typeof result.token !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(result.token)
  )
    throw new Error("Confirmação de perfil inválida.");
  const encrypted = safeStorage.isEncryptionAvailable();
  secrets()[userId] = {
    encrypted,
    value: encrypted ? safeStorage.encryptString(result.token).toString("base64") : result.token,
  };
  pending.delete(userId);
  return getEditorProfile(null, userId);
}
export async function saveProfileLayout(_: unknown, userId: string, layout: unknown) {
  validUser(userId);
  const bearer = token(userId);
  if (!bearer) throw new Error("Confirme sua conta antes de salvar.");
  return request("/api/client/badge-layout", "PUT", layout, bearer);
}
export async function resetProfileLayout(_: unknown, userId: string, expectedRevision: number) {
  validUser(userId);
  const bearer = token(userId);
  if (!bearer) throw new Error("Confirme sua conta antes de restaurar.");
  return request("/api/client/badge-layout", "DELETE", { expectedRevision }, bearer);
}
export async function disconnectProfileLayout(_: unknown, userId: string) {
  validUser(userId);
  const bearer = token(userId);
  if (bearer) await request("/api/client/badge-layout/disconnect", "POST", {}, bearer);
  delete secrets()[userId];
}
