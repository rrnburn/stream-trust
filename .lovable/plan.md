

## Remove HLS and Direct VLC Fallback Buttons

**File**: `src/components/VideoPlayer.tsx`

Remove the `isMovie && (...)` block (lines 574-589) containing the "VLC (HLS)" and "VLC (Direct)" buttons. Also remove the now-unused `hlsSrc` and `bareSrc` variables (lines 547-549).

