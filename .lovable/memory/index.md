# Memory: index.md
Updated: now

# Project Memory

## Core
- Dual-mode architecture: Supabase/Edge Functions (cloud) and Capacitor/SQLite (local-first native).
- Capacitor Android app must allow cleartext HTTP and mixed-content for streams.
- Stream proxy bypasses CORS/IP blocks, uses EXTERNAL_PROXY_URL, masks User-Agent.
- Data ops: 500-record batch inserts, lazy-loaded infinite scroll (30 items at once).
- Log all events/errors to `log-event` edge function: `[Component] [LEVEL] message | key=value`.
- UI: Cinematic charcoal/amber, dark mode only, viewport-fit=cover safe areas.
- Terminology: 'Favourite', 'Unfavourite'.
- Constraint: Do not add in-app updates (Play Store violation).
- Downloads are native-only; web shows an info card.

## Memories
- [Visual Aesthetic](mem://style/aesthetic) — Charcoal and amber, Inter/Space Grotesk, native dark mode, glassmorphism.
- [Dual-mode Architecture](mem://tech/stack-architecture) — Supabase/Edge Functions (cloud) and Capacitor/SQLite (local-first native).
- [Dual Identity Model](mem://auth/identity-model) — Cloud email/pwd, local-first for native, Android biometric login.
- [Live TV UI](mem://features/live-tv-experience) — Inline video player, searchable/collapsible sections.
- [High-volume Playlist Parsing](mem://tech/database-performance) — Server-side (cloud) vs client-side (native) parsing, batch inserts of 500.
- [Stream Proxy & Fallback](mem://tech/stream-proxy-logic) — Edge proxy to fix CORS/mixed-content, fallback to external residential proxy.
- [Series Metadata](mem://features/series-management) — get-series-info edge function, dedicated episode modal.
- [Media Catalog UI Performance](mem://tech/ui-performance) — Infinite scroll (30 items), React.memo, lazy imagery.
- [Centralized Logging](mem://tech/logging-and-diagnostics) — log-event Edge Function, [Component] [LEVEL] message | key=value.
- [Playback Error Recovery](mem://features/playback-recovery) — Manual retry with exponential backoff (max 3 attempts).
- [Capacitor Cleartext/Mixed Content](mem://tech/native-security-config) — Allow mixed content and cleartext HTTP for IPTV streams.
- [Safe Area Support](mem://style/safe-area-support) — viewport-fit=cover and CSS safe-area variables.
- [Native Video Player](mem://features/video-player) — Internal vs External (VLC/MX Player) via ACTION_VIEW, original provider format.
- [Xtream API Integration](mem://tech/xtream-api-integration) — Respect provider protocol, dynamic URL construction via container_extension.
- [No In-App Updates](mem://tech/ci-cd-workflow) — In-app update logic is forbidden due to Play Store requirements.
- [Content Navigation & Library](mem://features/content-library) — Watch history grouped by category, auto-expanding sidebar, 'Favourite'/'Unfavourite'.
- [In-App Log Viewer](mem://tech/in-app-diagnostics) — /debug route, stacked layout, clipboard export.
- [EPG (Electronic Program Guide)](mem://features/epg-integration) — XMLTV data, case-insensitive heuristic match, horizontal strip / full grid.
- [Casting & Sharing](mem://features/casting-and-sharing) — Google Cast SDK, proxied stream URLs.
- [Offline Downloads](mem://features/offline-downloads) — Capacitor Filesystem streaming write, SQLite metadata, /downloads page.
