

## Fix Sidebar Auto-Expand for Active Route

### Problem
The `expandedSections` state is initialized once via `useState` initializer. When the user navigates to `/movies`, `/series`, or `/live-tv`, the state doesn't update — it only reflects whatever route was active at first render. The sidebar sections never auto-expand on route changes.

### Solution
Add a `useEffect` that watches `location.pathname` and automatically adds the current route to `expandedSections` when it changes.

### Changes

**File: `src/components/AppSidebar.tsx`**

Add a `useEffect` after the `expandedSections` state declaration (after line 37):

```typescript
useEffect(() => {
  const matchingItem = navItems.find(item => item.to === location.pathname);
  if (matchingItem?.category) {
    setExpandedSections(prev => {
      if (prev.has(matchingItem.to)) return prev;
      const next = new Set(prev);
      next.add(matchingItem.to);
      return next;
    });
  }
}, [location.pathname]);
```

Also add `useEffect` to the import on line 5.

This ensures that whenever the user navigates to a category page (Movies, Series, Live TV), the corresponding sub-menu automatically expands to show the group list.

