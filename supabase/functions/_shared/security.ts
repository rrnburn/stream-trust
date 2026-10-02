import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Mask Xtream credentials embedded in URLs or query strings. */
export function redactSecrets(input: string): string {
  return input
    .replace(/\/(live|movie|series|timeshift)\/[^/\s]+\/[^/\s]+\//gi, '/$1/***/***/')
    .replace(/([?&](?:username|password|user|pass|token)=)[^&\s]*/gi, '$1***')
    .replace(/(\/\/)[^/@\s:]+:[^/@\s]+@/g, '$1***:***@');
}

function isPrivateIPv4(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return false;
  const [a, b] = p;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIPv6(ip: string): boolean {
  const l = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (l === '::' || l === '::1') return true;
  if (l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80')) return true;
  const mapped = l.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

/**
 * Reject URLs that are not http(s) or that point at loopback, private,
 * link-local or metadata addresses (directly or via DNS).
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http(s) URLs are allowed');
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
    host.endsWith('.internal') || host === 'metadata.google.internal'
  ) {
    throw new Error('Destination not allowed');
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isPrivateIPv4(host)) throw new Error('Destination not allowed');
    return u;
  }
  if (host.includes(':')) {
    if (isPrivateIPv6(host)) throw new Error('Destination not allowed');
    return u;
  }
  const addrs: string[] = [];
  try { addrs.push(...(await Deno.resolveDns(host, 'A'))); } catch { /* ignore */ }
  try { addrs.push(...(await Deno.resolveDns(host, 'AAAA'))); } catch { /* ignore */ }
  if (addrs.length === 0) throw new Error('Could not resolve host');
  for (const a of addrs) {
    if (a.includes(':') ? isPrivateIPv6(a) : isPrivateIPv4(a)) throw new Error('Destination not allowed');
  }
  return u;
}

/** Fetch with manual redirect handling so every hop is validated. */
export async function safeFetch(raw: string, init: RequestInit = {}, maxRedirects = 5): Promise<Response> {
  let current = raw;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      try { await res.body?.cancel(); } catch { /* ignore */ }
      current = new URL(res.headers.get('location')!, current).toString();
      continue;
    }
    return res;
  }
  throw new Error('Too many redirects');
}

/** Returns the authenticated user id from the request's bearer token, or null. */
export async function getAuthUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data, error } = await client.auth.getClaims(auth.slice(7));
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub as string;
}
