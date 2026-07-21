import { getAvailableProfiles, OFFICE_SLOT_IDS } from "./officeProfiles.js";
import { resolveOfficeAvatar } from "./officeState.js";
import { WorkAvatarEditor } from "./WorkAvatarEditor.jsx";

const LABELS = { boss: "老板", employee1: "员工 1", employee2: "员工 2", employee3: "员工 3", employee4: "员工 4" };
const SOURCE_LABELS = { me: "我 APP", character: "角色 APP", npc: "NPC" };

export function EmployeeManager({ profiles, state, dispatch, onError }) {
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  return (
    <div className="employee-manager">
      <div className="employee-manager-intro">
        <p>为五个工位安排角色</p>
        <span>首次为空 · 每个角色只能出现一次</span>
      </div>
      {OFFICE_SLOT_IDS.map((slotId) => {
        const profileId = state.assignments[slotId];
        const profile = profileMap.get(profileId);
        const avatar = profile ? resolveOfficeAvatar(profile, state.avatarOverrides) : "";
        return (
          <section className="employee-slot" key={slotId}>
            <div className="employee-slot-heading">
              <div className="employee-slot-avatar">{avatar ? <img src={avatar} alt="" /> : <span>{profile?.name?.slice(0, 1) || "空"}</span>}</div>
              <div><strong>{LABELS[slotId]}</strong><small>{profile ? `${SOURCE_LABELS[profile.source]} · ${profile.name || "未命名"}` : "未安排"}</small></div>
            </div>
            <label className="employee-slot-select">
              <span>选择角色</span>
              <select value={profileId || ""} onChange={(event) => dispatch({ type: "ASSIGN", slotId, profileId: event.target.value || null })}>
                <option value="">未安排</option>
                {getAvailableProfiles(profiles, state.assignments, slotId).map((item) => <option key={item.id} value={item.id}>{SOURCE_LABELS[item.source]} · {item.name || "未命名角色"}</option>)}
              </select>
            </label>
            {profile && <WorkAvatarEditor override={state.avatarOverrides[profile.id]} onChange={(value) => dispatch({ type: "SET_AVATAR_OVERRIDE", profileId: profile.id, value })} onClear={() => dispatch({ type: "CLEAR_AVATAR_OVERRIDE", profileId: profile.id })} onError={onError} />}
          </section>
        );
      })}
    </div>
  );
}
