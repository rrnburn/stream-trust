

## Move Sub-Category Filters to the Sidebar

Currently, Movies, Series, and Live TV pages show horizontal scrolling group/category filter buttons at the top of the content area. The user wants these moved into the left sidebar instead.

### Approach

The sidebar already has expandable sub-menus for Live TV, Movies, and Series (with group links). The sub-menu in the sidebar and the top filter buttons do the same thing — they set `?group=X` in the URL. So the fix is simply to **remove the horizontal filter bars from the three pages** and rely on the existing sidebar sub-menus.

### Changes

**File 1: `src/pages/Movies.tsx`**
- Remove the horizontal group filter bar (lines 46-66) — the `groups.length > 1 && (...)` block
- Remove the `groups` useMemo (lines 21-23) since it's no longer needed in this component

**File 2: `src/pages/Series.tsx`**
- Same removal: delete the horizontal group filter bar (lines 46-66)
- Remove the `groups` useMemo (lines 21-23)

**File 3: `src/pages/LiveTV.tsx`**
- Remove the group filter buttons inside the channel list panel (lines 109-133) — the `allGroups.length > 1 && (...)` block
- Remove the `allGroups` useMemo (lines 24-27)

**File 4: `src/components/AppSidebar.tsx`**
- Auto-expand the sidebar section for the current active route (e.g. if on `/movies`, the Movies sub-menu should be open by default)
- This makes the sidebar groups immediately visible when navigating to those pages

No other changes needed — the sidebar already constructs the correct `?group=` links and highlights the active group.

