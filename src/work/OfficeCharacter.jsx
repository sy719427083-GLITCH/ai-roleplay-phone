export function OfficeCharacter({ profile, avatar, node, facing = "right", moving = false, durationMs = 700, activity = "working", label = "工作中", bubble = "" }) {
  return (
    <div
      className={`office-character ${moving ? "is-moving" : "is-active"} ${bubble ? "has-bubble" : ""}`}
      data-facing={facing}
      data-activity={activity}
      data-profile-id={profile.id}
      style={{ "--x": `${node.x}%`, "--y": `${node.y}%`, "--walk-duration": `${durationMs}ms` }}
    >
      {bubble && <span className="office-character-bubble" role="status" aria-live="polite">{bubble}</span>}
      <span className="office-character-name">{profile.name || "未命名角色"}</span>
      <span className="office-character-body">
        {avatar ? <img src={avatar} alt="" /> : <span className="office-character-fallback">{(profile.name || "?").slice(0, 1)}</span>}
      </span>
      <span className="office-character-activity" title={label}>{label}</span>
    </div>
  );
}
