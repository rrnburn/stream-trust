

## Implement Local EPG Logic for Native App

### Problem
The `LocalAppProvider` has a stub `parseEpg` that fetches XMLTV but doesn't parse or store programs. It also references `epg_url` (undefined variable — the build error). The local SQLite DB has no `epg_programs` table.

### Changes

**1. `src/lib/localDb.ts`** — Add EPG table and CRUD functions:
- Add `CREATE TABLE IF NOT EXISTS epg_programs` (columns: `id`, `source_id`, `channel_id`, `title`, `description`, `start_time`, `end_time`, `category`) to `initLocalDb`
- Add `getEpgPrograms()` — select programs where `end_time > now` and `start_time < now+24h`
- Add `insertEpgPrograms(sourceId, programs[])` — delete old programs for source, batch insert new ones
- Add `epg_url` column to `iptv_sources` table schema
- Update `addSourceLocal` to accept and store `epg_url`

**2. `src/lib/epgParser.ts`** — New file, client-side XMLTV parser:
- Port the regex-based XMLTV parsing logic from `supabase/functions/parse-epg/index.ts` to a TypeScript module
- `parseXmlTvLocal(xml: string, sourceId: string)` returns array of `{ channel_id, title, description, start_time, end_time, category }`
- Filter to next 24 hours only

**3. `src/context/AppContext.tsx`** — Wire up local EPG in `LocalAppProvider`:
- Fix build error: line 155 `epg_url` → `epgUrl`
- Import new `insertEpgPrograms`, `getEpgPrograms` from localDb
- Import `parseXmlTvLocal` from epgParser
- In `parseEpg`: fetch XMLTV XML, parse with `parseXmlTvLocal`, store via `insertEpgPrograms`, reload `epgPrograms` state
- In `reload`: load EPG programs from local DB into state
- Use `source.epg_url` (from the source param) instead of component-level `epgUrl` state for the EPG URL, removing the need for `epgUrl` state entirely — or fall back to auto-detected `epgUrl` from playlist parsing

