# Worldbook Tags and Work Maps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the immersive worldbook header, add ordered one-to-three world tags, and provide a distinct selectable work map with unique places and hit areas for every supported tag.

**Architecture:** Put tag normalization and ordering in a focused `worldTags.js` module, expand `workThemes.js` into a tag-addressable registry, and keep screen state orchestration in `App.jsx`. Generated map and outline assets remain static files under `public/`; worldbook data keeps `genre` for backward compatibility while `tags` becomes authoritative.

**Tech Stack:** React 19, Vite 6, CSS, Node test runner, localStorage, generated PNG assets, GitHub Pages.

## Global Constraints

- A world has one to three concrete tags and no visible category grouping.
- Tags display in the approved historical order.
- Each of 25 tags has a distinct map composition, five places, hit areas, and building outlines.
- Work in progress allows map browsing but blocks starting a second job.
- The worldbook background covers the iOS status area while controls and title remain below the Dynamic Island.
- Increment the application version and deploy `dist/` to `docs/`.

---

### Task 1: Ordered World Tag Model

**Files:**
- Create: `src/worldTags.js`
- Create: `src/worldTags.test.js`
- Modify: `src/App.jsx`

**Interfaces:**
- Produces: `WORLD_TAGS`, `normalizeWorldTags(world)`, `serializeWorldGenre(tags)`, and `toggleWorldTag(tags, tag, limit)`.
- Consumes: legacy world objects containing `genre` strings.

- [ ] **Step 1: Write failing tests** asserting the exact 25-tag order, legacy `genre` migration, duplicate removal, and a maximum of three selections.
- [ ] **Step 2: Run `node --test src/worldTags.test.js`** and verify failure because `worldTags.js` does not exist.
- [ ] **Step 3: Implement the tag constants and pure normalization helpers** with `tags` authoritative and `genre` split on `/、·,，` plus whitespace.
- [ ] **Step 4: Run `node --test src/worldTags.test.js`** and verify all tag tests pass.
- [ ] **Step 5: Commit** `src/worldTags.js` and `src/worldTags.test.js` with message `Add ordered world tag model`.

### Task 2: Worldbook Tag Selection and Migration

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Test: `src/worldTags.test.js`

**Interfaces:**
- Consumes: `WORLD_TAGS`, `normalizeWorldTags`, `serializeWorldGenre`, `toggleWorldTag`.
- Produces: saved worlds with `tags: string[]` and compatible `genre: string`.

- [ ] **Step 1: Add a failing persistence test** proving a legacy world receives ordered tags and saving preserves no more than three.
- [ ] **Step 2: Run the focused test** and confirm the saved object lacks `tags`.
- [ ] **Step 3: Replace the material-page genre shortcut with an inline ordered tag grid** in the world editor; selected chips show ordinal selection and the save button is disabled until one tag exists.
- [ ] **Step 4: Update creation and read normalization** so each world stores `tags` and `genre: tags.join("/")`; render concrete tags on library rows.
- [ ] **Step 5: Run all tests and commit** with message `Add three-tag worldbook editor`.

### Task 3: Immersive Worldbook Header Fix

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Test: `design-qa.md`

**Interfaces:**
- Produces: a background layer independent of the safe-area content layer.

- [ ] **Step 1: Reproduce at a 390 x 844 iPhone viewport** and save the failing screenshot showing the missing artwork and title collision.
- [ ] **Step 2: Replace the header image flow element with an absolute background board** using `inset: 0`, `object-fit: cover`, and `object-position: center top`.
- [ ] **Step 3: Remove the library hero negative top margin** and place `.worldbook-library-back`, `.worldbook-library-tools`, and `.worldbook-library-head` relative to `max(env(safe-area-inset-top), 44px)` plus visual clearance.
- [ ] **Step 4: Capture a new phone screenshot** proving artwork reaches the top and all controls sit below the status area.
- [ ] **Step 5: Update `design-qa.md` and commit** with message `Fix worldbook immersive safe area`.

### Task 4: Twenty-Five Tag Map Registry

**Files:**
- Modify: `src/workThemes.js`
- Modify: `src/workThemes.test.js`

**Interfaces:**
- Produces: `TAG_WORK_THEME_IDS`, `getThemeIdForTag(tag)`, and 25 entries in `WORK_MAP_THEMES`.
- Each theme provides `{ id, tag, name, asset, places[5] }` and each place provides a unique `type`, name, work copy, pin, and hit area.

- [ ] **Step 1: Add failing tests** that every tag resolves to a theme, all themes have five places, asset names are unique, and normalized hit-area signatures are not all identical.
- [ ] **Step 2: Run `node --test src/workThemes.test.js`** and verify missing theme failures.
- [ ] **Step 3: Define 25 theme entries** with different place vocabularies and spatial patterns such as ring, radial, diagonal, vertical depth, islands, layers, and star nodes.
- [ ] **Step 4: Update inference** to prefer an explicitly selected tag and migrate old six-theme ids to the closest new tag theme.
- [ ] **Step 5: Run tests and commit** with message `Expand work maps to all world tags`.

### Task 5: Generate Distinct Map and Outline Assets

**Files:**
- Create: `public/work-map-assets/map-<tag-id>.png` for all 25 tags
- Create: `public/work-map-outlines/<tag-id>-<place-type>.png` for five places per tag
- Modify: `src/workThemes.test.js`

**Interfaces:**
- Consumes: exact `asset`, place `type`, and hit-area definitions from `WORK_MAP_THEMES`.
- Produces: 25 full-screen maps and 125 transparent selected-building outlines.

- [ ] **Step 1: Extend asset tests** to verify every declared map and outline file exists and is non-empty; run them to see missing-file failures.
- [ ] **Step 2: Generate 25 clean illustrated maps** with distinct compositions and no embedded UI text.
- [ ] **Step 3: Generate or extract transparent white building contours** aligned to each map's five registered places.
- [ ] **Step 4: Run asset tests and inspect representative modern, ancient, fantasy, science-fiction, ocean, and underworld maps at phone size.**
- [ ] **Step 5: Commit assets** in logical batches with message `Add distinct tag work map assets`.

### Task 6: Tag Map Selection in Work App

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Modify: `src/workThemes.js`
- Test: `src/workThemes.test.js`

**Interfaces:**
- Consumes: selected world's normalized `tags` and `getThemeIdForTag`.
- Produces: persisted selected tag per world and the corresponding `themeId`.

- [ ] **Step 1: Add failing tests** proving a three-tag world exposes three map choices, defaults to the first, and resolves a different theme after selection.
- [ ] **Step 2: Run focused tests** and confirm current resolver only returns one inferred theme.
- [ ] **Step 3: Add compact world-tag controls** below the reality/other-world switch; persist selection under a dedicated localStorage key keyed by world id.
- [ ] **Step 4: Switch map, jobs, API prompt, outline path, and hotspot data together** when a tag is selected.
- [ ] **Step 5: Preserve active-work locking** so maps remain browsable while all start actions stay disabled until completion or stop.
- [ ] **Step 6: Run all tests and commit** with message `Add selectable world tag maps to work`.

### Task 7: Visual Verification, Version, and Deployment

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`
- Modify: `docs/.deploy-version`
- Regenerate: `docs/`

**Interfaces:**
- Produces: deployed GitHub Pages build with matching version and asset hashes.

- [ ] **Step 1: Run `npm test`** and require all tests to pass.
- [ ] **Step 2: Run `npm run build`** and verify Vite completes without errors.
- [ ] **Step 3: Test at 390 x 844**: worldbook safe area, one/three-tag cards, each tag switch, unique hotspots, active-work browse lock, and bottom safe area.
- [ ] **Step 4: Increment the patch version everywhere** and rebuild.
- [ ] **Step 5: Sync `dist/` to `docs/`**, excluding `.nojekyll`, `.deploy-version`, and `superpowers/`; run `git diff --check`.
- [ ] **Step 6: Commit and push**, leaving untracked `designs/` untouched.
- [ ] **Step 7: Verify the live `.deploy-version` and hashed JS/CSS URLs** on GitHub Pages.
