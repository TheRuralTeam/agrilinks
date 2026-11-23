import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const tokensUrl = new URL("../design-system/tokens.json", import.meta.url);
const tokens = JSON.parse(readFileSync(tokensUrl, "utf8"));

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Invalid color: ${hex}`);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function assertContrast(foreground, background, label) {
  const ratio = contrast(foreground, background);
  if (ratio < 4.5) throw new Error(`${label} contrast is ${ratio.toFixed(2)}:1; expected at least 4.5:1`);
}

function hslChannels(hex) {
  const [red, green, blue] = hex.match(/[a-f\d]{2}/gi).map((channel) => parseInt(channel, 16) / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }

  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
}

function assertWebCssAdapter() {
  const cssPath = fileURLToPath(new URL("../src/index.css", import.meta.url));
  if (!existsSync(cssPath)) return;

  const css = readFileSync(cssPath, "utf8");
  const expected = {
    "--primary": color.brand.primary,
    "--primary-foreground": color.brand.onPrimary,
    "--success": color.status.success.color,
    "--success-foreground": color.status.success.onColor,
    "--warning": color.status.warning.color,
    "--warning-foreground": color.status.warning.onColor,
    "--destructive": color.status.danger.color,
    "--destructive-foreground": color.status.danger.onColor,
    "--info": color.status.info.color,
    "--info-foreground": color.status.info.onColor,
    "--muted-foreground": color.text.secondary,
    "--border": color.border.default,
    "--border-strong": color.border.strong,
    "--background-secondary": color.surface.subtle,
  };

  for (const selector of [":root", ".dark"]) {
    const block = css.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]+)\\}`))?.[1];
    if (!block) throw new Error(`Missing ${selector} color adapter.`);
    for (const [name, hex] of Object.entries(expected)) {
      const actual = block.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
      if (actual !== hslChannels(hex)) {
        throw new Error(`${selector} ${name} is ${actual ?? "missing"}; expected ${hslChannels(hex)} from the shared manifest.`);
      }
    }
  }
}

const { color } = tokens;
assertContrast(color.brand.onPrimary, color.brand.primary, "Brand button");
for (const [name, value] of Object.entries(color.text)) {
  assertContrast(value, color.surface.canvas, `Text ${name}`);
}
for (const [name, value] of Object.entries(color.status)) {
  assertContrast(value.onColor, value.color, `Status ${name} on solid`);
  assertContrast(value.text, value.surface, `Status ${name} on surface`);
}

if (tokens.theme !== "light") throw new Error("Only the audited light theme is declared.");
if (tokens.control.touchTarget < 44) throw new Error("Touch targets must be at least 44 px.");
if (!tokens.safeArea.web || !tokens.safeArea.native) throw new Error("Safe-area rules are required.");
assertWebCssAdapter();

const peerPath = process.env.AGRILINK_PEER_TOKENS;
if (peerPath) {
  const peer = readFileSync(peerPath, "utf8");
  const local = readFileSync(fileURLToPath(tokensUrl), "utf8");
  if (peer !== local) throw new Error("The peer client token manifest differs from this manifest.");
}

console.log(`AgriLink design tokens v${tokens.version}: contrast and platform adapters passed.`);
