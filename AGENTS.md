# Architecture rules

- Native Search reads paginated SQLite results through a lazy import, independently of the in-memory catalog; web Search retains the cloud catalog path so native plugins never load on web.
- Native media details can load a single row by ID from SQLite so search results remain playable before catalog hydration finishes.
- Native downloads request canonical provider URLs only during transfer, try both native engines, and do not probe redirects or rewrite hosts through public DNS services; probes can consume provider tokens and lookup backups can stall on restricted networks.
- Android test signing reads a persistent keystore from CI secrets, never source control; production signing stays separate to protect release identity.
- Android CI version codes use a validated offset plus workflow run number; raise the offset before resetting the workflow counter to preserve upgrade order.
- Playback teardown cancels initialization timers/listeners and stops the captured media element before clearing its source, preventing stale sessions from restarting audio.