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
