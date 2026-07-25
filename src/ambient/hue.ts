import { Agent } from "undici";

export const HUE_TIMEOUT_MS = 8000;

const hueAgent = new Agent({
  connect: { rejectUnauthorized: false },
});

export async function hueFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HUE_TIMEOUT_MS);
  try {
    return await fetch(url, {
      // @ts-ignore undici agent
      dispatcher: hueAgent,
      signal: controller.signal,
      ...init,
    } as any);
  } finally {
    clearTimeout(timeout);
  }
}

export async function setHueColor(
  ip: string,
  username: string,
  lightId: number,
  cie: { x: number; y: number },
  brightness: number,
  transitionMs: number,
): Promise<void> {
  const bri = Math.max(1, Math.min(254, Math.round((brightness / 100) * 254)));
  const tt = Math.max(0, Math.round(transitionMs / 100));
  const res = await hueFetch(`https://${ip}/api/${username}/lights/${lightId}/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ on: true, xy: [cie.x, cie.y], bri, transitiontime: tt }),
  });
  if (!res.ok) throw new Error(`Hue ${res.status}`);
}

export async function discoverHueBridges(): Promise<string[]> {
  try {
    const res = await fetch("https://discovery.meethue.com/", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { internalipaddress: string }[];
    return data.map((d) => d.internalipaddress).filter(Boolean);
  } catch { return []; }
}

export async function createHueUser(ip: string): Promise<string> {
  for (let i = 0; i < 3; i++) {
    const res = await hueFetch(`https://${ip}/api`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ devicetype: "opencode_ambient#ambient" }),
    });
    const data = (await res.json()) as any[];
    if (data[0]?.success?.username) return data[0].success.username;
    const err = data[0]?.error;
    if (err?.type === 101) {
      if (i < 2) await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    throw new Error(err?.description ?? JSON.stringify(data));
  }
  throw new Error("Press link button on bridge, then try again");
}

export async function getHueLights(ip: string, username: string): Promise<{ id: number; name: string }[]> {
  const res = await hueFetch(`https://${ip}/api/${username}/lights`);
  if (!res.ok) throw new Error(`Hue lights ${res.status}`);
  const data = (await res.json()) as Record<string, { name: string }>;
  return Object.entries(data).map(([id, info]) => ({ id: parseInt(id, 10), name: info.name }));
}

export async function flashHue(ip: string, username: string, lightId: number): Promise<void> {
  await hueFetch(`https://${ip}/api/${username}/lights/${lightId}/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ alert: "select" }),
  });
}
