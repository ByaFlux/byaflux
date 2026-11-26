import { NativeSettings } from "@main/settings";
import { createHash, randomBytes } from "node:crypto";
import { safeStorage, shell } from "electron";
import { createServer, type Server } from "node:http";
const API = "https://byaflux.discloud.dev";
type Secret = { value: string; encrypted: boolean };
type Connection = {
  requestId: string;
  verifier: string;
  expiresAt: number;
  server: Server;
  timer?: ReturnType<typeof setTimeout>;
  profile?: Record<string, any>;
  error?: string;
  consuming?: boolean;
};
const pending = new Map<string, Connection>();
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
export function cancelLayoutConnection(_: unknown, userId: string) {
  const connection = pending.get(userId);
  if (!connection) return;
  pending.delete(userId);
  clearTimeout(connection.timer);
  connection.server.close();
}
export async function beginLayoutConnection(_: unknown, userId: string) {
  validUser(userId);
  cancelLayoutConnection(null, userId);
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("hex");
  let port = 0;
  const connection = {} as Connection;
  const server = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    let url: URL;
    try {
      url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    } catch {
      res.writeHead(400).end("Solicitação inválida.");
      return;
    }
    if (
      req.method !== "GET" ||
      req.headers.host !== `127.0.0.1:${port}` ||
      url.origin !== `http://127.0.0.1:${port}` ||
      (req.url?.length ?? 0) > 2048 ||
      url.pathname !== "/byaflux-badges/callback" ||
      url.searchParams.get("request") !== connection.requestId ||
      pending.get(userId) !== connection ||
      connection.expiresAt < Date.now()
    ) {
      res.writeHead(404).end("Confirmação inválida ou expirada. Volte ao ByaFlux.");
      return;
    }
    const grant = url.searchParams.get("grant");
    if (!grant || !/^[A-Za-z0-9_-]{43}$/.test(grant) || connection.consuming) {
      res.writeHead(400).end("Confirmação inválida. Volte ao ByaFlux.");
      return;
    }
    connection.consuming = true;
    try {
      const result = await request(
        `/api/client/badge-layout/link/${connection.requestId}`,
        "POST",
        { verifier, grant },
      );
      if (pending.get(userId) !== connection) throw new Error("A confirmação foi cancelada.");
      if (
        result.profileId !== userId ||
        typeof result.token !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(result.token)
      )
        throw new Error("A conta confirmada não corresponde ao perfil aberto.");
      const encrypted = safeStorage.isEncryptionAvailable();
      secrets()[userId] = {
        encrypted,
        value: encrypted
          ? safeStorage.encryptString(result.token).toString("base64")
          : result.token,
      };
      const profile = await getEditorProfile(null, userId);
      if (!profile.connected)
        throw new Error("Não foi possível carregar o perfil confirmado. Tente novamente.");
      if (pending.get(userId) !== connection) throw new Error("A confirmação foi cancelada.");
      connection.profile = profile;
      res.end(
        "<!doctype html><meta charset=utf-8><title>ByaFlux</title><h1>Perfil confirmado pelo Discord.</h1><p>Pode voltar ao ByaFlux. A conexão foi concluída automaticamente.</p>",
      );
    } catch (error) {
      connection.error =
        error instanceof Error ? error.message : "Não foi possível confirmar o perfil.";
      res.writeHead(400).end("Não foi possível concluir. Volte ao ByaFlux para tentar novamente.");
    } finally {
      connection.server.close();
      clearTimeout(connection.timer);
    }
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 1000;
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  server.unref();
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Não foi possível iniciar a confirmação local.");
  }
  port = address.port;
  Object.assign(connection, { requestId: "", verifier, expiresAt: Date.now() + 600000, server });
  pending.set(userId, connection);
  try {
    const result = await request("/api/client/badge-layout/link", "POST", {
      userId,
      challenge,
      callbackPort: port,
    });
    if (pending.get(userId) !== connection) throw new Error("A confirmação foi cancelada.");
    if (result.flow !== "discord-loopback-v1")
      throw new Error(
        "Atualize a API do ByaFlux para 1.3.2 para confirmar automaticamente com Discord.",
      );
    if (!/^[A-Za-z0-9_-]{43}$/.test(result.requestId) || !Number.isFinite(result.expiresAt))
      throw new Error("Resposta de confirmação inválida. Atualize a API do ByaFlux.");
    Object.assign(connection, {
      requestId: result.requestId,
      verifier,
      expiresAt: result.expiresAt,
      server,
    });
    pending.set(userId, connection);
    connection.timer = setTimeout(
      () => {
        connection.error = "A confirmação expirou. Clique em Confirmar com Discord novamente.";
        server.close();
      },
      Math.max(0, result.expiresAt - Date.now()),
    );
    connection.timer.unref();
    await shell.openExternal(`${API}/auth/profile?request=${encodeURIComponent(result.requestId)}`);
    return { expiresAt: result.expiresAt };
  } catch (error) {
    server.close();
    if (pending.get(userId) === connection) cancelLayoutConnection(null, userId);
    else clearTimeout(connection.timer);
    throw error;
  }
}
export async function checkLayoutConnection(_: unknown, userId: string) {
  validUser(userId);
  const connection = pending.get(userId);
  if (!connection) throw new Error("Inicie uma nova confirmação com Discord.");
  if (connection.profile) {
    const profile = connection.profile;
    cancelLayoutConnection(null, userId);
    return profile;
  }
  if (connection.error || connection.expiresAt < Date.now()) {
    const message = connection.error ?? "A confirmação expirou. Tente novamente.";
    cancelLayoutConnection(null, userId);
    throw new Error(message);
  }
  return { pending: true, expiresAt: connection.expiresAt };
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
