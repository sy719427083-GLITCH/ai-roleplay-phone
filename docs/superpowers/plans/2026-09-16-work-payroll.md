# Work wages and countdown

Implemented: one timed project per workday; selectable 1/5/15-minute wall-clock duration, default 5; wages project/editor/admin = 300/260/220. Timer starts when requirements are accepted. Delivery requires completed review and expired timer. Existing completed projects do not receive retroactive income; the next day uses the new rules.

Career save keeps the payroll identity and start timestamp. Settlement saves a pending delivery, atomically writes wallet balance plus a durable receipt in roleplayWallet, then marks the career paid. Retry after either write failure cannot duplicate wages. Web Locks serialize salary claims across tabs; receipt history survives clearing visible wallet transactions and ordinary wallet transactions. Original worldbooks and characters remain read-only.

Top bar: remove border and explicitly disable shadow, filter, backdrop filter, and pseudo-element layers. Desktop browser did not reproduce the reported blur; mobile viewport visually verified as flat.

Validation: Node tests cover timer expiry/reload, premature delivery, duplicate settlement, cleared wallet history, write failure before and after credit, and legacy migration. Browser fixture verifies timer and real Wallet app integration without touching user data.
