---
name: tanstack-outlet-layouts
description: >-
  Detects and fixes TanStack Router parent routes that render a full page without
  `<Outlet />`, which swallows child routes (category pages, pay pages, dashboards).
  Use proactively when adding or editing routes under src/routes, when a URL loads
  the parent page instead of the child, when navigation "does nothing", or when the
  user mentions broken child routes, layout bugs, or service/advertise/verify pages
  not opening. Run the scan after any route-tree change and fix all offenders before
  finishing.
---

# TanStack Outlet Layout Guard

## Symptom

URL matches a **child** route (loader data may even be present in SSR), but the HTML
shows the **parent** page. Example: `/services/electricians` rendered
"Everything your new home needs" instead of provider cards.

**Root cause:** Parent `createFileRoute` component has no `<Outlet />`.

## When to run (mandatory)

1. Before finishing any task that touches `src/routes/**` or `routeTree.gen.ts`
2. When a user reports a page that "doesn't open" or shows the wrong screen
3. After adding a new nested route (`parent.child.tsx` or `parent.$param.tsx`)

Do not wait for the user to name this bug — scan and fix automatically.

## Detection

Run from the app root (`find-nyumba-smart/`):

```bash
node .cursor/skills/tanstack-outlet-layouts/scripts/scan-outlet-layouts.mjs
```

Exit code `1` = offenders found. Fix every listed parent before continuing.

Manual check if the script is unavailable:

1. In `src/routeTree.gen.ts`, find every `*RouteWithChildren` / `_addFileChildren`.
2. For each parent file `src/routes/<parent>.tsx`, confirm the component renders `<Outlet />`.
3. If it renders a full page (forms, shells, marketing) and has children → **offender**.

Parents that already correctly use Outlet (do not "fix"): `tenant`, `landlord`,
`agency`, `manager`, `admin`, `caretaker`, `tenant.messages`, `services` (after fix).

## Fix pattern (required)

Split parent into **layout** + **index**. Children keep their own shells/wrappers.

### 1. Parent becomes layout only

```tsx
// src/routes/example.tsx
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/example")({
  component: ExampleLayout,
});

function ExampleLayout() {
  return <Outlet />;
}
```

### 2. Move old page to index

```tsx
// src/routes/example.index.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/example/")({
  // head, validateSearch, component — moved from parent
  component: ExamplePage,
});
```

Copy the previous parent body into the index file. Change only:

- `createFileRoute("/example")` → `createFileRoute("/example/")`
- Keep `validateSearch` / `head` on the index (or the leaf that needs them)

### 3. Nested parents (e.g. `/landlord/properties`)

Same pattern:

- `landlord.properties.tsx` → `<Outlet />` only
- `landlord.properties.index.tsx` → list page (with `LandlordShell` if it had one)
- Children (`new`, `$id/edit`) already wrap their own shell — **do not** double-wrap
  the parent in `LandlordShell` unless every child is shell-less

### 4. Regenerate and verify

```bash
npx @tanstack/router-cli generate
npx tsc --noEmit
node .cursor/skills/tanstack-outlet-layouts/scripts/scan-outlet-layouts.mjs
```

Live/SSR check for each fixed child URL:

- Child-specific copy is present (e.g. "Complete your campaign", provider names)
- Parent-only copy is **absent** (e.g. "Send an enquiry" on `/advertise/pay`)

## Known offenders fixed in this repo (reference)

| Parent | Children |
|--------|----------|
| `/services` | `$category`, `provider/*`, `register` |
| `/advertise` | `pay` |
| `/verify` | `request`, `status/$requestId` |
| `/auth` | `reset`, `pending` |
| `/landlord/dashboard` | `billing`, `plan` |
| `/landlord/properties` | `new`, `$id/edit` |
| `/agency/properties` | `new`, `$id/edit` |
| `/manager/properties` | `new`, `$id/edit` |

## Do not

- Leave a parent with both a full page UI and children
- Put `<Outlet />` beside the full page (children still won't replace the page)
- Skip the scan after adding routes
- Commit while `scan-outlet-layouts.mjs` exits `1`
