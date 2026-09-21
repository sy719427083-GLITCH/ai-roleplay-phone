# Office activity variety implementation

Approved by user: center avatars on desks, random activity/startup, expand work and include watching TV, Douyin and games.

1. Add a weighted activity catalog for desk work, thinking/rest, leisure, collaboration, coffee/tea/water, printing, whiteboard, filing, watering and reporting. Avoid immediate repeats.
2. Center home anchors horizontally on each desk, enter/exit via own desk front, preserve shared aisles. Test other-desk exclusion.
3. Randomize desk activities, durations and event selection; seed reproducibly for tests and warm initial state so new openings differ. Preserve group coordination/identity cancellation and exclusive resources.
4. Render small activity badges and subtle leisure animations; reduced-motion disables animation.
5. Verify startup diversity, long-run activity coverage, paths and previous regression tests. Browser-check layout, then bump patch and deploy main.

Constraints: immutable office atlas/source records, no API calls, four empty utility pages remain unchanged.
