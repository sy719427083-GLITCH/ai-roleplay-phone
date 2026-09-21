# Desk visit implementation

User requested seated employees receiving coworkers for collaboration, questions and casual talk, in addition to existing shared-floor chats.

- Add weighted desk-visit activities and six visitor anchors on the aisle-facing side of each employee desk.
- Select two distinct identities from available employees. Reserve host at home in waiting state; route visitor to its visitor anchor. Start only after both are present.
- Reuse the existing chat group API/local dialogue, speech and hold. Include host desk in activity topic.
- End/cancel hosts directly into desk work rather than routing a loop; preserve pending assignments. Visitors return through aisles.
- Test sampled routes, stationary host, visitor arrival and return, prolonged dialogue hold, and existing regressions. Browser review and patch deployment.
