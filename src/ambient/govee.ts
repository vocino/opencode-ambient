import { createSocket } from "dgram";
import type { RgbColor } from "../types.js";

const MC_ADDR = "239.255.255.250";
const MC_PORT = 4001;
const DISC_RECV = 4002;
const CTRL_PORT = 4003;
const TIMEOUT = 5000;

export interface DiscoveredGovee {
  ip: string;
  device: string;
  sku: string;
}

export async function discoverGovee(timeoutMs = TIMEOUT): Promise<DiscoveredGovee[]> {
  const found = new Map<string, DiscoveredGovee>();
  return new Promise((resolve) => {
    let sock: ReturnType<typeof createSocket> | null = null;
    try {
      sock = createSocket({ type: "udp4", reuseAddr: true });
      sock.on("error", () => { try { sock?.close(); } catch {} });
      sock.on("message", (buf: any) => {
        try {
          const p = JSON.parse(buf.toString("utf-8")) as any;
          const d = p?.msg?.data;
          if (d?.ip && d?.device) found.set(d.device, { ip: d.ip, device: d.device, sku: d.sku ?? "unknown" });
        } catch {}
      });
      sock.bind(DISC_RECV, () => {
        try { sock!.addMembership(MC_ADDR); } catch {}
        const msg = Buffer.from(JSON.stringify({ msg: { cmd: "scan", data: { account_topic: "reserve" } } }));
        sock!.send(msg, MC_PORT, MC_ADDR, () => {});
      });
      setTimeout(() => { try { sock?.close(); } catch {}; resolve([...found.values()]); }, timeoutMs);
    } catch { resolve([]); }
  });
}

function sendUdp(ip: string, payload: object, timeoutMs = 2500): Promise<void> {
  return new Promise((r) => {
    const s = createSocket("udp4");
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; try { s.close(); } catch {}; r(); } }, timeoutMs);
    s.bind(() => {
      s.send(Buffer.from(JSON.stringify(payload)), CTRL_PORT, ip, () => {
        // fire-and-forget ok, some devices never ack
        if (!done) { done = true; clearTimeout(t); try { s.close(); } catch {}; r(); }
      });
    });
    s.on("error", () => { if (!done) { done = true; clearTimeout(t); try { s.close(); } catch {}; r(); } });
  });
}

export async function setGoveePower(ip: string, on: boolean): Promise<void> {
  await sendUdp(ip, { msg: { cmd: "turn", data: { val: on ? 1 : 0 } } });
}

export async function setGoveeBrightness(ip: string, bri: number): Promise<void> {
  const v = Math.max(0, Math.min(100, Math.round(bri)));
  await sendUdp(ip, { msg: { cmd: "brightness", data: { val: v } } });
}

export async function setGoveeColor(ip: string, rgb: RgbColor): Promise<void> {
  await sendUdp(ip, { msg: { cmd: "colorwc", data: { color: { r: rgb.r, g: rgb.g, b: rgb.b }, colorTemInKelvin: 0 } } });
}
