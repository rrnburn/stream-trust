

## Plan: Make Debug Logs Mobile-Friendly

### Problems on mobile
1. **Filter buttons overflow** — 6 buttons in a horizontal row don't fit on small screens
2. **Log entries are a single horizontal row** — timestamp, badge, component, and message all on one line causes horizontal overflow
3. **No padding** — content sits edge-to-edge with the sidebar margin

### Changes to `src/pages/DebugLogs.tsx`

1. **Header + filters**: Stack title above filters on mobile. Make filter buttons scrollable horizontally with `overflow-x-auto` and smaller sizing.

2. **Log entries**: Switch from a single-line flex row to a stacked layout on mobile:
   - **Top line**: timestamp + level badge + component tag
   - **Bottom line**: the log message (full width, wrapping allowed)

3. **Container padding**: Add `p-3` to the outer wrapper so content doesn't touch screen edges.

4. **Font sizing**: Use `text-[11px]` for log messages on mobile for better density while remaining readable.

Single file change: `src/pages/DebugLogs.tsx`

