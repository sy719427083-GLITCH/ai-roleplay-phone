# Work Office Chat and Idle Resume Correction Design

Date: 2026-07-28

Status: Approved for specification review

## Goal

Correct two autonomous-office behaviors in V0.3.18:

- never present one character speaking alone as an office conversation;
- return the assigned Me profile to autonomous behavior after 10 seconds without a new furniture click.

## Root Causes

The local scene scheduler already requires at least two planned chatters, but parsed AI dialogue currently accepts two valid turns even when both turns belong to the same speaker. It then derives a one-person participant list, allowing a solo speech-bubble sequence to reach rendering.

Manual Me interruption currently creates a long-lived manual activity and movement route. It has no dedicated resettable idle timer, so finishing or abandoning a click-driven action does not restore autonomy after the requested 10-second inactivity window.

## Conversation Invariant

A valid office conversation always contains at least two distinct, currently assigned profile IDs.

- The local planner continues requiring two to four distinct profiles.
- AI dialogue parsing accepts only known speakers, then requires at least two distinct speaker IDs after sanitation.
- Scene-plan validation rejects a conversation with fewer than two distinct participants, even if the raw participant array contains duplicates.
- The runtime rechecks assigned, distinct participants before generating dialogue or rendering bubbles.
- If a participant is removed, reassigned, or manually interrupted and fewer than two remain, end the conversation immediately and clear its bubbles.
- Two or more turns from one speaker are ordinary generated text but not a conversation; discard them and use no solo bubble.
- AI dialogue failure may use local fallback only when at least two distinct participants remain.

## Ten-Second Me Idle Resume

Every valid furniture click for the assigned Me profile starts a fresh 10,000 ms manual-control idle window.

1. Cancel the previous manual idle timer.
2. Interrupt Me's autonomous route, conversation membership, and resource reservation.
3. Start the new manual route and persist a manual state whose `endsAt` equals the click time plus 10,000 ms.
4. A new valid furniture click before expiry immediately replaces the route and restarts the full 10,000 ms window.
5. When the latest timer expires without another click, clear the manual state and derive a fresh autonomous plan for Me from the current global interval.

Only furniture clicks reset this timer. Opening settings, project management, or other Work pages does not extend manual control. Unmounting the Work APP cancels the in-memory timer; reopening reconstructs state from persisted `endsAt`. An already expired manual state is discarded immediately without replay.

The resume event must not wait for the next 15-minute planning interval. It reuses the current global context but produces a new plan identity so movement restarts immediately. Other profiles keep their current activities unless capacity reallocation is required after Me rejoins.

## Failure and Edge Handling

- With zero or one assigned profile, no conversation request or bubble is created.
- If an AI response has only one distinct speaker, treat it as invalid dialogue and clear the conversation rather than repeatedly requesting AI.
- If Me is unassigned during the 10-second window, cancel the timer and manual state.
- If Me's autonomous resume destination is temporarily unavailable, keep Me at the last safe point and locally replan; do not restore the expired manual activity.
- Multiple rapid clicks have one authoritative timer identified by a monotonically increasing run ID, preventing an older timeout from canceling a newer command.

## Testing

Automated tests cover:

- two AI turns from one speaker being rejected;
- duplicate participant IDs failing scene validation;
- runtime dialogue and bubbles stopping when only one distinct participant remains;
- one-person offices making no conversation request;
- a click setting `endsAt` to exactly `now + 10_000`;
- a second click resetting the full interval and invalidating the first timeout;
- the latest timeout clearing manual state and immediately replanning Me;
- unmount and reassignment cleanup;
- restoration before and after persisted manual expiry.

Browser QA verifies that a one-person fixture never displays a bubble and that Me resumes autonomous movement after 10 seconds of click inactivity. It also verifies that clicking again before expiry delays resumption until 10 seconds after the latest click.

## Delivery

Bump the patch release to V0.3.19, run the full test suite, production build, and both mobile browser sizes, synchronize Pages assets, push `main`, wait for the GitHub Pages workflow, and verify the live V0.3.19 bundle.
