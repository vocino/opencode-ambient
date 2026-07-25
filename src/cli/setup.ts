import { select, input, confirm } from "@inquirer/prompts";
import { discoverHueBridges, createHueUser, getHueLights, flashHue } from "../ambient/hue.js";
import { discoverGovee } from "../ambient/govee.js";
import { saveConfig, defaultConfig, ensureConfigDir } from "../config/config.js";
import type { AmbientConfig } from "../types.js";

export async function runSetup(): Promise<void> {
  ensureConfigDir();
  const cfg = defaultConfig();

  console.log("\n opencode-ambient setup — Hue + Govee\n");

  const useHue = await confirm({ message: "Use Philips Hue?", default: true });
  if (useHue) {
    let ip = cfg.hue.ip;
    try {
      const bridges = await discoverHueBridges();
      if (bridges.length > 0) {
        const picked = await select({
          message: "Hue bridge",
          choices: [...bridges.map((b) => ({ name: b, value: b })), { name: "Manual IP", value: "manual" }],
        });
        if (picked === "manual") ip = await input({ message: "Bridge IP", default: "10.0.0.10" });
        else ip = picked;
      } else {
        ip = await input({ message: "Hue bridge IP (10.0.0.10)", default: "10.0.0.10" });
      }
    } catch {
      ip = await input({ message: "Hue bridge IP", default: "10.0.0.10" });
    }

    console.log(`Press link button on ${ip} then hit enter`);
    await input({ message: "Press enter after link button" });

    const username = await createHueUser(ip);
    console.log(`Hue linked ${username.slice(0, 8)}...`);

    const lights = await getHueLights(ip, username);
    const lightChoice = await select({
      message: "Pick light",
      choices: lights.map((l) => ({ name: `${l.name} (id ${l.id})`, value: l })),
    });

    try { await flashHue(ip, username, lightChoice.id); } catch {}

    cfg.hue = { enabled: true, ip, username, lightId: lightChoice.id, lightName: lightChoice.name };
  }

  const useGovee = await confirm({ message: "Use Govee?", default: false });
  if (useGovee) {
    console.log("Scanning Govee LAN (239.255.255.250:4001)...");
    const found = await discoverGovee(4000);
    let pickedIp = cfg.govee.ip;
    let device = "";
    let sku = "H60B0";

    if (found.length > 0) {
      const choice = await select({
        message: "Govee device",
        choices: [
          ...found.map((d) => ({ name: `${d.sku} ${d.device} @ ${d.ip}`, value: d })),
          { name: "Manual IP", value: null as any },
        ],
      });
      if (choice) {
        pickedIp = choice.ip; device = choice.device; sku = choice.sku;
      } else {
        pickedIp = await input({ message: "Govee IP", default: "10.0.0.11" });
      }
    } else {
      pickedIp = await input({ message: "Govee IP (not found via scan)", default: "10.0.0.11" });
    }

    cfg.govee = { enabled: true, ip: pickedIp, device, sku };
  }

  saveConfig(cfg);
  console.log(`\nConfig saved ~/.opencode-ambient/config.json`);
  console.log(`Hue: ${cfg.hue.enabled ? `${cfg.hue.lightName} @ ${cfg.hue.ip}` : "disabled"}`);
  console.log(`Govee: ${cfg.govee.enabled ? `${cfg.govee.sku} @ ${cfg.govee.ip}` : "disabled"}`);
  console.log("\nNext: opencode-ambient start && opencode-ambient demo\n");
}
