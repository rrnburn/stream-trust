const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Expose-Headers': 'content-length, content-range, content-type, accept-ranges',
};

const FETCH_TIMEOUT_MS = 15_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const reqId = crypto.randomUUID().substring(0, 8);

  try {
    const url = new URL(req.url);
    const streamUrl = url.searchParams.get('url');

    if (!streamUrl) {
      console.error(`[${reqId}] Missing url parameter`);
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract origin domain for Referer header
    const streamOrigin = new URL(streamUrl).origin;
    
    console.log(`[stream-proxy] [INFO] [${reqId}] Incoming request | url=${streamUrl.substring(0, 120)}`);

    // Use minimal headers — Xtream panels are sensitive to extra headers
    const headers: Record<string, string> = {
      'User-Agent': 'okhttp/4.9.2',
      'Accept': '*/*',
      'Referer': streamOrigin + '/',
    };

    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
      console.log(`[stream-proxy] [DEBUG] [${reqId}] Range header | range=${rangeHeader}`);
    }

    // Try multiple fetch strategies: HTTPS → HTTP → different User-Agent
    const fetchStrategies = [
      { url: streamUrl, ua: 'okhttp/4.9.2', label: 'HTTPS+okhttp' },
      { url: streamUrl.replace(/^https:\/\//i, 'http://'), ua: 'okhttp/4.9.2', label: 'HTTP+okhttp' },
      { url: streamUrl, ua: 'VLC/3.0.20 LibVLC/3.0.20', label: 'HTTPS+VLC' },
      { url: streamUrl.replace(/^https:\/\//i, 'http://'), ua: 'VLC/3.0.20 LibVLC/3.0.20', label: 'HTTP+VLC' },
      { url: streamUrl, ua: 'Lavf/60.16.100', label: 'HTTPS+ffmpeg' },
      { url: streamUrl.replace(/^https:\/\//i, 'http://'), ua: 'Lavf/60.16.100', label: 'HTTP+ffmpeg' },
    ];

    let upstream: Response | null = null;
    let lastError = '';

    for (const strategy of fetchStrategies) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const stratHeaders = { ...headers, 'User-Agent': strategy.ua };
        const res = await fetch(strategy.url, { headers: stratHeaders, signal: controller.signal, redirect: 'follow' });
        clearTimeout(timeoutId);
        
        if (res.ok || res.status === 206) {
          console.log(`[stream-proxy] [INFO] [${reqId}] Strategy "${strategy.label}" succeeded | status=${res.status}`);
          upstream = res;
          break;
        } else {
          lastError = `${strategy.label}: HTTP ${res.status}`;
          console.log(`[stream-proxy] [WARN] [${reqId}] Strategy "${strategy.label}" failed | status=${res.status}`);
          // Consume body to free connection
          try { await res.text(); } catch {}
        }
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        const msg = err instanceof Error ? err.message : 'Unknown';
        lastError = `${strategy.label}: ${msg}`;
        console.log(`[stream-proxy] [WARN] [${reqId}] Strategy "${strategy.label}" errored | error=${msg}`);
      }
    }

    // If all direct strategies failed, try external proxy
    if (!upstream) {
      let externalProxyUrl = Deno.env.get('EXTERNAL_PROXY_URL') || '';
      // Ensure the URL has a protocol prefix
      if (externalProxyUrl && !externalProxyUrl.startsWith('http')) {
        externalProxyUrl = `http://${externalProxyUrl}`;
      }
      if (externalProxyUrl) {
        console.log(`[stream-proxy] [INFO] [${reqId}] Direct fetch failed, trying external proxy`);
        const proxyStrategies = [
          { url: streamUrl, label: 'proxy-original' },
          { url: streamUrl.replace(/^https:\/\//i, 'http://'), label: 'proxy-http' },
        ];

        for (const ps of proxyStrategies) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
          try {
            const proxyTarget = `${externalProxyUrl}?url=${encodeURIComponent(ps.url)}`;
            const res = await fetch(proxyTarget, {
              headers: rangeHeader ? { 'Range': rangeHeader } : {},
              signal: controller.signal,
              redirect: 'follow',
            });
            clearTimeout(timeoutId);

        if (res.ok || res.status === 206) {
              // Validate that the proxy actually returned media, not an HTML error page
              const proxyCt = (res.headers.get('content-type') || '').toLowerCase();
              const proxyLen = parseInt(res.headers.get('content-length') || '0', 10);
              const isHtml = proxyCt.includes('text/html') || proxyCt.includes('text/plain');
              const isTiny = proxyLen > 0 && proxyLen < 100_000; // real video is > 100KB
              
              if ((isHtml || isTiny) && !ps.url.endsWith('.html') && !ps.url.includes('.m3u')) {
                const body = await res.text();
                const looksLikeHtml = body.trimStart().startsWith('<') || body.includes('<!DOCTYPE') || body.includes('<html');
                if (isHtml || looksLikeHtml) {
                  lastError = `${ps.label}: proxy returned HTML/block page (ct=${proxyCt}, len=${proxyLen}, htmlDetected=${looksLikeHtml})`;
                  console.log(`[stream-proxy] [WARN] [${reqId}] ${lastError}`);
                  continue;
                }
              }
              
              console.log(`[stream-proxy] [INFO] [${reqId}] External proxy "${ps.label}" succeeded | status=${res.status} ct=${proxyCt} len=${proxyLen}`);
              upstream = res;
              break;
            } else {
              lastError = `${ps.label}: HTTP ${res.status}`;
              console.log(`[stream-proxy] [WARN] [${reqId}] External proxy "${ps.label}" failed | status=${res.status}`);
              try { await res.text(); } catch {}
            }
          } catch (err: unknown) {
            clearTimeout(timeoutId);
            const msg = err instanceof Error ? err.message : 'Unknown';
            lastError = `${ps.label}: ${msg}`;
            console.log(`[stream-proxy] [WARN] [${reqId}] External proxy "${ps.label}" errored | error=${msg}`);
          }
        }
      }

      if (!upstream) {
        console.error(`[stream-proxy] [ERROR] [${reqId}] All strategies (including external proxy) failed | last=${lastError}`);
        return new Response(JSON.stringify({ error: `All fetch strategies failed: ${lastError}` }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Determine content type
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    console.log(`[stream-proxy] [INFO] [${reqId}] Upstream OK | status=${upstream.status} contentType=${contentType}`);

    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    };

    // Forward content-length, content-range, accept-ranges for seeking
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) responseHeaders['Content-Length'] = contentLength;

    const contentRange = upstream.headers.get('content-range');
    if (contentRange) responseHeaders['Content-Range'] = contentRange;

    const acceptRanges = upstream.headers.get('accept-ranges');
    if (acceptRanges) responseHeaders['Accept-Ranges'] = acceptRanges;

    // For m3u8 manifests, rewrite segment URLs to go through proxy
    const isManifest = streamUrl.endsWith('.m3u8') || streamUrl.endsWith('.m3u')
      || contentType.includes('mpegurl') || contentType.includes('m3u');

    if (isManifest) {
      const body = await upstream.text();

      // Build the proxy base URL using the known Supabase URL pattern
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || url.origin;
      const proxyBase = `${supabaseUrl}/functions/v1/stream-proxy`;

      // Get the base URL for relative segment URLs
      const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);

      const lines = body.split('\n');
      const rewritten = lines.map(line => {
        const trimmed = line.trim();

        // Rewrite URI= in EXT-X-KEY, EXT-X-MAP, etc.
        if (trimmed.includes('URI="')) {
          return trimmed.replace(/URI="([^"]+)"/g, (_, uri) => {
            let fullUri = uri;
            if (!fullUri.startsWith('http')) {
              fullUri = baseUrl + fullUri;
            }
            return `URI="${proxyBase}?url=${encodeURIComponent(fullUri)}"`;
          });
        }

        // Non-comment, non-empty lines are segment/playlist URLs
        if (trimmed && !trimmed.startsWith('#')) {
          let segmentUrl = trimmed;
          if (!segmentUrl.startsWith('http')) {
            segmentUrl = baseUrl + segmentUrl;
          }
          return `${proxyBase}?url=${encodeURIComponent(segmentUrl)}`;
        }

        return line;
      }).join('\n');

      console.log(`[stream-proxy] [INFO] [${reqId}] Manifest rewritten | lines=${lines.length} baseUrl=${baseUrl.substring(0, 60)}`);

      responseHeaders['Content-Type'] = 'application/vnd.apple.mpegurl';
      delete responseHeaders['Content-Length'];

      return new Response(rewritten, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }

    // For binary content (ts segments, mp4, etc.), stream directly
    console.log(`[stream-proxy] [INFO] [${reqId}] Streaming binary | contentLength=${contentLength || 'unknown'}`);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : '';
    console.error(`[stream-proxy] [ERROR] [${reqId}] Unhandled exception | error=${msg}`);
    if (stack) console.error(`[stream-proxy] [ERROR] [${reqId}] Stack trace | ${stack}`);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
