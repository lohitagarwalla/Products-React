const ROLE_CLAIM = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

// Decoding controls the UI only. The API verifies the JWT and authorizes every write.
export function readJwt(token, now = Date.now()) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some(part => !part)) return null;
    const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "=")), c => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= now) return null;
    if (Number.isFinite(claims.nbf) && claims.nbf * 1000 > now) return null;
    const roles = [claims[ROLE_CLAIM], claims.role, claims.roles].flat()
      .filter(role => typeof role === "string");
    const userId = claims["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"]
      ?? claims.nameid ?? claims.sub;
    const name = claims["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"]
      ?? claims.name;
    const firstName = typeof name === "string" ? name.trim().split(/\s+/)[0] : "";
    return { roles: [...new Set(roles)], expiresAt: claims.exp * 1000,
      userId: typeof userId === "string" ? userId : null, firstName };
  } catch {
    return null;
  }
}
