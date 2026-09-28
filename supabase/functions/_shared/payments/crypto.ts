export async function importHmacSha256Key(secret: ArrayBuffer): Promise<CryptoKey> {
  if (secret.byteLength === 0) throw new Error("Webhook secret must not be empty");

  return crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

export async function verifyHmacSha256(
  payload: ArrayBuffer,
  signature: ArrayBuffer,
  key: CryptoKey,
): Promise<boolean> {
  if (signature.byteLength !== 32 || key.algorithm.name !== "HMAC") return false;
  return crypto.subtle.verify("HMAC", key, signature, payload);
}

export async function sha256Hex(payload: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
