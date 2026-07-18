# Office 0.2.97 Release Evidence

## Visual Result

- Open-plan pearl-white office with no interior walls or partitions.
- One boss desk and four employee desks centered on their five rug zones.
- All desks face forward with horizontal front edges.
- The fixed refreshment counter uses one dynamic set of stools and real food props.
- Sixteen new high-resolution chibi identities: eight female and eight male, split evenly between boss and employee roles.

## Automated Verification

- `npm test`: 177 passed, 0 failed.
- `node --test --test-reporter=spec scripts/office-art-spec.test.mjs src/work/officeAssets.test.js`: 22 passed, 0 failed.
- `npm run verify:office`: passed at 375x812 and 390x844.
- `npm run deploy:pages`: production build and Pages sync passed.

## Interaction Coverage

- Smooth route sampling every 50ms without teleporting.
- Work, slack, game, reading, series, short-video, and eating atlas rows match their visible status.
- Two simultaneous conversations remain isolated.
- Long numeric dialogue wraps without horizontal or vertical clipping.
- Assignment flow reads bosses from Me profiles and employees from Character/NPC profiles.

## Published Asset Inventory

- `docs/.deploy-version`: `0.2.97`
- 16 chibi WebP atlases at 2048x2048.
- 10 station WebP modules at 1080x1920.
- 4 break WebP modules at 1080x1920.
- 1 office background WebP at 1080x1920.
- 0 legacy Office PNG files.

## Screenshots

- `docs/superpowers/qa/office-375x812.png`
- `docs/superpowers/qa/office-390x844.png`
- `docs/superpowers/qa/office-chibis-contact-sheet.webp`
