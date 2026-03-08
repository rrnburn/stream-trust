

## Analysis: Why Playback Stopped Working

### Root Cause

The IPTV provider (`cf.gaminghub8k.xyz`) is actively blocking requests from two directions:

1. **Direct browser playback** -- Error code 4 on `video.src`. The provider is likely checking the `Origin`/`Referer` header and rejecting requests from web app domains. This is a server-side restriction, not a code bug.

2. **Proxy (Edge Function)** -- HTTP 458 on every single request, across all 6 User-Agent strategies and both HTTP/HTTPS. The provider has blocklisted datacenter/cloud IP ranges (which is where backend functions run).

This is a **provider-side change**, not a code regression. The code is correct -- the provider has tightened their anti-piracy/anti-scraping rules since it last worked.

### What Won't Fix It

- Changing User-Agent strings (already tried 6 variants -- all get 458)
- Switching HTTP/HTTPS protocols (already tried both -- all get 458)
- Converting MP4 to M3U8 URLs (provider returns 551 for those)
- Native `video.src` vs hls.js vs mpegts.js (all fail at the network level)

### Viable Solutions

**Option A: External CORS Proxy Service (Recommended)**
- Use a third-party CORS proxy with residential IPs (e.g., a self-hosted proxy on a VPS with a residential IP, or a service like AllOrigins/cors-anywhere)
- The Edge Function would route requests through this external proxy instead of fetching directly
- Requires setting up or subscribing to such a service and adding the URL as a secret

**Option B: Embed an External Player**
- Use an `<iframe>` pointing to a lightweight HTML page hosted elsewhere (e.g., on a VPS with a residential IP) that loads the video natively
- The video element on the external page wouldn't have CORS restrictions from the provider's perspective

**Option C: Accept the Limitation**
- Show a clear, user-friendly error explaining the provider is blocking web playback
- Suggest the user try a different IPTV source/provider that doesn't block datacenter IPs
- Add a "Copy Stream URL" button so users can paste into VLC or another native player

### Technical Plan for Option A

1. **Add a secret** for an external proxy URL (e.g., `EXTERNAL_PROXY_URL`)
2. **Update `stream-proxy` Edge Function** to route requests through the external proxy when direct fetch fails with 458
3. **No changes needed to `VideoPlayer.tsx`** -- the existing proxy fallback logic would work once the Edge Function can successfully fetch

### Technical Plan for Option C (Simplest)

1. **Update `VideoPlayer.tsx`** error UI to show provider-specific messaging
2. **Add a "Copy URL to clipboard"** button so users can open streams in VLC/native players
3. Minimal code changes, no external dependencies

