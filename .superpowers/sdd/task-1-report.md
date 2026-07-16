# Task 1 Report: Correct Profile Sources And Snapshots

## What changed
- `readOfficeProfiles(storage)` now reads bosses from `apiMeProfiles` and employees from `apiCharacters`.
- Added `createOfficeProfileSnapshot(profile, source)` so snapshots preserve source-specific fields.
- Updated `createNpcProfile(slotId, kind)` to mark fallback profiles with `source: "fallback"` and include the missing shape fields.
- Kept `normalizeOfficeAssignments(value, profiles)` source-gated through the boss/employee profile maps so a Me profile cannot land in an employee slot and a Character profile cannot land in the boss slot.
- Rewrote the office profile tests to cover the new source boundary and snapshot shape.

## Files changed
- `src/work/officeProfiles.js`
- `src/work/officeProfiles.test.js`

## RED
Command:
```bash
node --test src/work/officeProfiles.test.js
```

Output:
```text
not ok 1 - uses Me profiles for bosses and all Character profiles for employees
  Expected values to be strictly deep-equal:
  + actual - expected
    [
  +   'main1'
  -   'me1'
    ]

not ok 2 - snapshots preserve source-specific role fields
  error: 'officeProfiles.createOfficeProfileSnapshot is not a function'

not ok 3 - fills missing and deleted assignments with named npc profiles
  Expected values to be strictly deep-equal:
  + actual - expected
    {
  +   generated: true,
  +   id: 'npc-employee4',
  +   identity: '临时员工',
  +   name: 'NPC',
  +   persona: '办公室临时角色',
  +   personality: '自然、友好'
  -   appearance: '',
  -   avatar: '',
  -   generated: true,
  -   id: 'npc-employee4',
  -   identity: '临时员工',
  -   name: 'NPC',
  -   persona: '办公室临时角色',
  -   personality: '自然、友好',
  -   source: 'fallback'
    }
```

## GREEN
Command:
```bash
node --test src/work/officeProfiles.test.js
```

Output:
```text
1..5
# tests 5
# pass 5
# fail 0
```

## Full suite
Command:
```bash
npm test
```

Result:
```text
1..118
# tests 118
# pass 118
# fail 0
```

## Self-review
- The boss/employee source split now matches the brief exactly.
- Snapshot shape is source-aware and preserves the character-only fields.
- Fallback NPCs now carry the requested source marker and stable defaults.
- I kept the change contained to the two owned files and left the rest of the app untouched.

## Concerns
- The report captures the key failure/pass lines rather than every TAP line from the test runner.
- I did not run a UI-level check because this task is confined to profile-source normalization and its tests.

## Fix Review

### Files changed
- `src/work/officeProfiles.test.js`
- `.superpowers/sdd/task-1-report.md`
- `src/work/officeProfiles.js` was not changed because the targeted test confirmed the existing source-specific maps already reject cross-source ids.

### Covering test
Command:
```bash
node --test src/work/officeProfiles.test.js
```

Output:
```text
TAP version 13
# Subtest: uses Me profiles for bosses and all Character profiles for employees
ok 1 - uses Me profiles for bosses and all Character profiles for employees
  ---
  duration_ms: 0.597625
  ...
# Subtest: snapshots preserve source-specific role fields
ok 2 - snapshots preserve source-specific role fields
  ---
  duration_ms: 0.049625
  ...
# Subtest: rejects cross-source assignment ids with named npc fallbacks
ok 3 - rejects cross-source assignment ids with named npc fallbacks
  ---
  duration_ms: 0.109917
  ...
# Subtest: fills missing and deleted assignments with named npc profiles
ok 4 - fills missing and deleted assignments with named npc profiles
  ---
  duration_ms: 0.418917
  ...
# Subtest: defaults safely in node and ignores null or non-object stored payloads
ok 5 - defaults safely in node and ignores null or non-object stored payloads
  ---
  duration_ms: 0.062833
  ...
# Subtest: treats null and array payloads as empty objects
ok 6 - treats null and array payloads as empty objects
  ---
  duration_ms: 0.044375
  ...
1..6
# tests 6
# suites 0
# pass 6
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 35.564875
```

### Full suite
Command:
```bash
npm test
```

Summary:
```text
1..119
# tests 119
# suites 0
# pass 119
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 293.158667
```

### Self-review
- The new test supplies one valid Me boss option and one valid Character employee option, then deliberately assigns each id to the opposite slot type.
- It verifies both slots use their exact named NPC fallback ids, carry `name: "NPC"` and `source: "fallback"`, and do not retain either cross-source id.
- The focused test confirmed the existing source-specific maps provide the required behavior, so no production code change was necessary.
- The change remains limited to the owned test and the required report update.

### Concerns
- None.
