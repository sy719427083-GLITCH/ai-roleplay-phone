# Task 6 Report: High-Resolution Office Character Library

## Result

- Replaced all sixteen office characters with new 2048x2048 WebP atlases.
- Female bosses and employees all use detailed long hairstyles with varied dresses, skirts, shorts, trousers, jackets, and accessories.
- Male bosses and employees cover executive, intellectual, creative, relaxed, streetwear, technical, and artistic styles.
- Every atlas follows the same 8x8 contract: right/front/back walking, work/slack, eat/game, read/series, short-video/chat, and idle/listen.

## Image Pipeline

- Used the built-in image generator once per identity on a flat chroma background.
- Removed chroma locally, detected uneven generated row/column layouts, and regridded every pose into 256px production cells.
- Preserved a twelve-pixel transparent gutter around every cell and cleared faint chroma pixels before WebP encoding.
- Runtime sampling remains a sharp integer 104px frame while using the 2x atlas source.

## Visual QA

- Added `scripts/build-office-chibi-contact-sheet.mjs`.
- Rebuilt `docs/superpowers/qa/office-chibis-contact-sheet.webp` with walk, work, and chat samples for all sixteen identities.
- The contact sheet caught one malformed boss work frame; its source row was regridded and the sheet regenerated.

## Verification

- `node --test --test-reporter=spec scripts/office-art-spec.test.mjs src/work/officeAssets.test.js`: 22 passed.
- All sixteen atlases decode at 2048x2048, contain 64 populated cells, preserve transparent corners and twelve-pixel gutters, and contain no green fringe.
- `npm run verify:office`: passed at 375x812 and 390x844, including continuous 50ms walk sampling, six desk activities, eating, two isolated chats, and long bubble wrapping.
