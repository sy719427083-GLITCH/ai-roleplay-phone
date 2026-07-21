export function OfficeCharacter({ profile, avatar, node, facing = "right", moving = false }) {
  return (
    <div
      className={`office-character ${moving ? "is-moving" : "is-working"}`}
      data-facing={facing}
      style={{ "--x": `${node.x}%`, "--y": `${node.y}%` }}
    >
      <span className="office-character-name">{profile.name || "未命名角色"}</span>
      <span className="office-character-body">
        {avatar ? <img src={avatar} alt="" /> : <span className="office-character-fallback">{(profile.name || "?").slice(0, 1)}</span>}
      </span>
    </div>
  );
}
