import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ChevronLeft, Ellipsis, FolderKanban, Timer, UsersRound } from "lucide-react";
import { EmployeeManager } from "./EmployeeManager.jsx";
import { OfficeScene } from "./OfficeScene.jsx";
import { findOfficeRoute, getRouteFacing } from "./officeNavigation.js";
import { readOfficeProfiles } from "./officeProfiles.js";
import { OFFICE_STORAGE_KEY, officeReducer, resolveOfficeAvatar, restoreOfficeState } from "./officeState.js";
import "./office.css";

const VIEW_TITLES = { settings: "工作设置", projects: "项目管理", timer: "工作倒计时", employees: "员工管理" };

export function WorkAppScreen({ onClose }) {
  const profiles = useMemo(() => readOfficeProfiles(), []);
  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const [state, dispatch] = useReducer(officeReducer, null, () => restoreOfficeState(window.localStorage.getItem(OFFICE_STORAGE_KEY), profiles));
  const [view, setView] = useState("office");
  const [notice, setNotice] = useState("");
  const movementTimer = useRef(null);
  const [meMovement, setMeMovement] = useState({ nodeId: state.meWaypoint, moving: false, facing: "right" });

  const occupants = useMemo(() => Object.entries(state.assignments).flatMap(([slotId, profileId]) => {
    const profile = profileMap.get(profileId);
    return profile ? [{ slotId, profile, avatar: resolveOfficeAvatar(profile, state.avatarOverrides) }] : [];
  }), [profileMap, state.assignments, state.avatarOverrides]);
  const meOccupant = occupants.find((item) => item.profile.source === "me");

  useEffect(() => {
    window.localStorage.setItem(OFFICE_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => () => window.clearTimeout(movementTimer.current), []);

  useEffect(() => {
    if (!meOccupant) return;
    const home = `${meOccupant.slotId}-home`;
    setMeMovement({ nodeId: home, moving: false, facing: "right" });
    dispatch({ type: "SET_WAYPOINT", waypoint: home });
  }, [meOccupant?.profile.id, meOccupant?.slotId]);

  const showNotice = (text) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const moveMe = (destination) => {
    if (!meOccupant) return showNotice("请先在员工管理中安排“我 APP”的角色");
    const route = findOfficeRoute(meMovement.nodeId, destination).slice(1);
    if (!route.length) return;
    window.clearTimeout(movementTimer.current);
    let current = meMovement.nodeId;
    const advance = () => {
      const next = route.shift();
      if (!next) return setMeMovement((value) => ({ ...value, moving: false }));
      const facing = getRouteFacing(current, next);
      current = next;
      setMeMovement({ nodeId: next, moving: true, facing });
      dispatch({ type: "SET_WAYPOINT", waypoint: next });
      movementTimer.current = window.setTimeout(advance, 430);
    };
    advance();
  };

  if (view !== "office") {
    return (
      <section className="work-app-screen work-subpage">
        <header className="work-page-header"><button type="button" onClick={() => setView("office")} aria-label="返回办公室"><ChevronLeft size={21} /></button><h1>{VIEW_TITLES[view]}</h1><span /></header>
        {view === "employees" ? <EmployeeManager profiles={profiles} state={state} dispatch={dispatch} onError={showNotice} /> : <section className="work-placeholder-page"><div className="work-placeholder-mark">{view === "projects" ? "P" : view === "timer" ? "T" : "S"}</div><h2>{VIEW_TITLES[view]}</h2><p>暂时留空</p></section>}
        {notice && <div className="work-notice" role="status">{notice}</div>}
      </section>
    );
  }

  return (
    <section className="work-app-screen">
      <header className="work-topbar">
        <button type="button" onClick={onClose} aria-label="返回主页"><ChevronLeft size={21} /></button>
        <div><strong>WORKROOM</strong><span>今天，也慢慢把事情做好</span></div>
        <button type="button" onClick={() => setView("settings")} aria-label="工作设置"><Ellipsis size={24} /></button>
      </header>
      <OfficeScene occupants={occupants} meMovement={meMovement} onObjectClick={moveMe} />
      <nav className="work-bottom-nav" aria-label="工作导航">
        <button type="button" onClick={() => setView("projects")}><FolderKanban size={18} /><span>项目管理</span></button>
        <button className="is-wide" type="button" onClick={() => setView("timer")}><Timer size={20} /><span>工作倒计时</span></button>
        <button type="button" onClick={() => setView("employees")}><UsersRound size={18} /><span>员工管理</span></button>
      </nav>
      {notice && <div className="work-notice" role="status">{notice}</div>}
    </section>
  );
}
