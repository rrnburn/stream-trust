# Remaining jobs

- [x] Implement optional secret-based Android test signing and validated increasing build versions; missing secret preserves existing builds with a warning.
- [ ] Enable stable signing: Robbie must add ANDROID_DEBUG_KEYSTORE_BASE64 in GitHub Actions; private key generation/backup stays on his computer.
- [x] Stop old Live TV audio and delayed playback callbacks when changing channels; retain the existing per-channel player key.
- [x] Detect existing video downloads without regex or scoped-storage existence-check failures; verify history entries through DownloadManager file access.
- [x] Verify configuration repeatability and playback cleanup: 17 focused tests passed; preview compilation reports build OK.
- [ ] Android CI/device verification: Build APK, install successive consistently signed versions, confirm retained downloads and rapid channel switching. Requires GitHub Actions and a physical device.

- [x] Job 4: Full-library native SQLite search, debounced input, category filters, 30-item pages, and detail lookup independent of startup hydration.
- [x] Phone verification: Search responsiveness confirmed by Robbie.
- [x] Download follow-up: Remove redirect pre-probes and external DNS/IP fallbacks; allow generic FileTransfer failures to reach the Filesystem engine.
- [ ] Phone verification: Retry a download on a rebuilt Android app; provider/network access and physical device are required.

Previously discussed optional work, not included in Job 4: manual Sync Guide button and parent-series resolution in Library History.