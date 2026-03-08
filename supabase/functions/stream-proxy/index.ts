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

    console.log(`[stream-proxy] [INFO] [${reqId}] Incoming request | url=${streamUrl.substring(0, 120)}`);

    // Forward range headers for video seeking
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Connection': 'keep-alive',
    };

    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
      console.log(`[stream-proxy] [DEBUG] [${reqId}] Range header | range=${rangeHeader}`);
    }

    // Fetch with timeout and abort
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let upstream: Response;
    try {
      upstream = await fetch(streamUrl, { headers, signal: controller.signal });
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      // If HTTPS fails, try HTTP fallback
      if (streamUrl.startsWith('https://')) {
        const httpUrl = streamUrl.replace(/^https:\/\//i, 'http://');
        console.log(`[stream-proxy] [WARN] [${reqId}] HTTPS failed, trying HTTP | url=${httpUrl.substring(0, 80)}`);
        const controller2 = new AbortController();
        const timeoutId2 = setTimeout(() => controller2.abort(), FETCH_TIMEOUT_MS);
        try {
          upstream = await fetch(httpUrl, { headers, signal: controller2.signal });
        } catch (httpErr: unknown) {
          clearTimeout(timeoutId2);
          const msg = httpErr instanceof Error ? httpErr.message : 'Unknown';
          console.error(`[stream-proxy] [ERROR] [${reqId}] Both HTTPS and HTTP failed | error=${msg}`);
          return new Response(JSON.stringify({ error: `Fetch failed: ${msg}` }), {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        clearTimeout(timeoutId2);
      } else {
        const msg = fetchErr instanceof Error ? fetchErr.message : 'Unknown';
        console.error(`[stream-proxy] [ERROR] [${reqId}] Fetch failed | error=${msg}`);
        return new Response(JSON.stringify({ error: `Fetch failed: ${msg}` }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    clearTimeout(timeoutId);

    if (!upstream!.ok && upstream!.status !== 206) {
      const statusText = upstream!.statusText || 'Unknown';
      console.error(`[stream-proxy] [ERROR] [${reqId}] Upstream error | status=${upstream!.status} statusText=${statusText}`);
      let errorBody = '';
      try { errorBody = await upstream!.text(); } catch {}
      if (errorBody) console.error(`[stream-proxy] [ERROR] [${reqId}] Upstream response body | body=${errorBody.substring(0, 200)}`);
      return new Response(JSON.stringify({ error: `Upstream ${upstream!.status}: ${statusText}` }), {
        status: upstream!.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine content type
    const contentType = upstream!.headers.get('content-type') || 'application/octet-stream';
    console.log(`[stream-proxy] [INFO] [${reqId}] Upstream OK | status=${upstream!.status} contentType=${contentType}`);

    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    };

    // Forward content-length, content-range, accept-ranges for seeking
    const contentLength = upstream!.headers.get('content-length');
    if (contentLength) responseHeaders['Content-Length'] = contentLength;

    const contentRange = upstream!.headers.get('content-range');
    if (contentRange) responseHeaders['Content-Range'] = contentRange;

    const acceptRanges = upstream!.headers.get('accept-ranges');
    if (acceptRanges) responseHeaders['Accept-Ranges'] = acceptRanges;

    // For m3u8 manifests, rewrite segment URLs to go through proxy
    const isManifest = streamUrl.endsWith('.m3u8') || streamUrl.endsWith('.m3u')
      || contentType.includes('mpegurl') || contentType.includes('m3u');

    if (isManifest) {
      const body = await upstream!.text();

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
        status: upstream!.status,
        headers: responseHeaders,
      });
    }

    // For binary content (ts segments, mp4, etc.), stream directly
    console.log(`[stream-proxy] [INFO] [${reqId}] Streaming binary | contentLength=${contentLength || 'unknown'}`);
    return new Response(upstream!.body, {
      status: upstream!.status,
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
