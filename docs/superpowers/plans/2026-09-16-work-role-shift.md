# Role-led workday simplification — 0.3.32

User correction: remove mandatory 30-character draft and simplify the process so characters matter.

Implemented workflow: start work, optionally ask the selected worldbook character to cooperate, finish after countdown. No draft/research/review prerequisite remains in delivery or payroll. Optional legacy notes stay accessible. A separate WorkShift component presents the active partner, opening message, a work incident with three one-click approaches, shared responses and closing feedback. All character prose uses the configured API with the existing character/world context. No canned character replies are presented when that API fails.

Successful support records one shared interaction; delegation shortens total work duration by up to 20 percent once. Work scenes persist with the project, appear in career history and are included only in that character's chat context. A failed or canceled API request applies no assistance effect and never prevents eventual wage collection. Wage receipts, existing timers, saves, and wallet data remain compatible.

Verification: pure transition tests cover no-writing delivery, idempotent assistance, unknown characters, late feedback and prompt context. Isolated browser fixture uses a mock API to test opening dialogue, selecting delegation, 12-second reduction in a 60-second shift, closing feedback and salary flow. The fixture does not use any real character data or live API credit.
