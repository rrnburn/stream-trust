# Architecture rules

- Native Search reads paginated SQLite results through a lazy import, independently of the in-memory catalog; web Search retains the cloud catalog path so native plugins never load on web.
- Native media details can load a single row by ID from SQLite so search results remain playable before catalog hydration finishes.