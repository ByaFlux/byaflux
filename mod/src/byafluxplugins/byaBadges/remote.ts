import { isHttpsUrl } from "./catalog";

export async function fetchRemoteCatalog(source: string | null): Promise<unknown> {
    if (!source || !isHttpsUrl(source)) throw new Error("A URL pública das badges não foi configurada.");
    const response = await fetch(source, { cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Falha ao carregar badges: HTTP ${response.status}`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Resposta de badges vazia.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 1024 * 1024) throw new Error("O catálogo excede 1 MiB.");
            chunks.push(value);
        }
    } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
}
