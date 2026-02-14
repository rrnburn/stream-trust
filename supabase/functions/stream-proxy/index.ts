import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Expose-Headers': 'content-length, content-range, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const streamUrl = url.searchParams.get('url');

    if (!streamUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Ensure we use HTTP for the upstream request (Xtream servers often only support HTTP)
    const httpUrl = streamUrl.replace(/^https:\/\//i, 'http://');

    // Forward range headers for video seeking
    const headers: Record<string, string> = {
      'User-Agent': 'okhttp/4.9.2',
      'Accept': '*/*',
    };

    const rangeHeader = req.headers.get('range');
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    console.log('[PROXY] Fetching:', httpUrl);

    const upstream = await fetch(httpUrl, { headers });

    if (!upstream.ok && upstream.status !== 206) {
      console.error('[PROXY] Upstream error:', upstream.status, upstream.statusText);
      return new Response(JSON.stringify({ 
        error: `Upstream error: ${upstream.status}`,
      }), {
        status: upstream.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine content type
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    };

    // Forward content-length and content-range for seeking
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) responseHeaders['Content-Length'] = contentLength;
    
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) responseHeaders['Content-Range'] = contentRange;

    // For m3u8 manifests, rewrite segment URLs to go through proxy
    if (httpUrl.endsWith('.m3u8') || contentType.includes('mpegurl') || contentType.includes('m3u')) {
      const body = await upstream.text();
      
      // Get the base URL for relative segment URLs
      const baseUrl = httpUrl.substring(0, httpUrl.lastIndexOf('/') + 1);
      const proxyBase = url.origin + url.pathname;
      
      // Rewrite relative URLs in the manifest to go through proxy
      const rewritten = body.split('\n').map(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          // This is a segment URL
          let segmentUrl = trimmed;
          if (!segmentUrl.startsWith('http')) {
            segmentUrl = baseUrl + segmentUrl;
          }
          return `${proxyBase}?url=${encodeURIComponent(segmentUrl)}`;
        }
        // Rewrite URI= in EXT-X-KEY and similar tags
        if (trimmed.includes('URI="')) {
          return trimmed.replace(/URI="([^"]+)"/g, (_, uri) => {
            let fullUri = uri;
            if (!fullUri.startsWith('http')) {
              fullUri = baseUrl + fullUri;
            }
            return `URI="${proxyBase}?url=${encodeURIComponent(fullUri)}"`;
          });
        }
        return line;
      }).join('\n');

      responseHeaders['Content-Type'] = 'application/vnd.apple.mpegurl';
      delete responseHeaders['Content-Length'];
      
      return new Response(rewritten, {
        status: upstream.status,
        headers: responseHeaders,
      });
    }

    // For binary content (ts segments, mp4, etc.), stream directly
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PROXY] Error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
