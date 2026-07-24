import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ChevronLeft, Ellipsis, FolderKanban, Timer, UsersRound } from "lucide-react";
import { EmployeeManager } from "./EmployeeManager.jsx";
import { OfficeScene } from "./OfficeScene.jsx";
import { getOfficePoint } from "./officeGeometry.js";
import { createOfficeRoute } from "./officeNavigation.js";
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
  const sceneRef = useRef(null);
  const movementTimer = useRef(null);
  const movementRun = useRef(0);
  const [meMovement, setMeMovement] = useState({ point: getOfficePoint(state.meWaypoint), moving: false, facing: "right", durationMs: 0 });

  const occupants = useMemo(() => Object.entries(state.assignments).flatMap(([slotId, profileId]) => {
    const profile = profileMap.get(profileId);
    return profile ? [{ slotId, profile, avatar: resolveOfficeAvatar(profile, state.avatarOverrides) }] : [];
  }), [profileMap, state.assignments, state.avatarOverrides]);
  const meOccupant = occupants.find((item) => item.profile.source === "me");

  useEffect(() => {
    window.localStorage.setItem(OFFICE_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => () => {
    movementRun.current += 1;
    window.clearTimeout(movementTimer.current);
  }, []);

  useEffect(() => {
    if (!meOccupant) return;
    const home = `${meOccupant.slotId}-home`;
    movementRun.current += 1;
    window.clearTimeout(movementTimer.current);
    setMeMovement({ point: getOfficePoint(home), moving: false, facing: "right", durationMs: 0 });
    dispatch({ type: "SET_WAYPOINT", waypoint: home });
  }, [meOccupant?.profile.id, meOccupant?.slotId]);

  const showNotice = (text) => {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const moveMe = (destination) => {
    if (!meOccupant) return showNotice("请先在员工管理中安排“我 APP”的角色");
    if (meMovement.moving) return;
    const bounds = sceneRef.current?.getBoundingClientRect();
    if (!bounds) return showNotice("办公室路线暂时不可用");
    const route = createOfficeRoute({
      from: meMovement.point,
      destination,
      viewport: { width: bounds.width, height: bounds.height },
    });
    if (!route.length) {
      if (getOfficePoint(destination) !== meMovement.point) showNotice("这里暂时没有可通行的路线");
      return;
    }
    window.clearTimeout(movementTimer.current);
    const run = movementRun.current + 1;
    movementRun.current = run;
    const advance = () => {
      if (movementRun.current !== run) return;
      const segment = route.shift();
      if (!segment) {
        setMeMovement((value) => ({ ...value, moving: false, durationMs: 0 }));
        dispatch({ type: "SET_WAYPOINT", waypoint: destination });
        return;
      }
      setMeMovement({ point: segment.point, moving: true, facing: segment.facing, durationMs: segment.durationMs });
      movementTimer.current = window.setTimeout(advance, segment.durationMs);
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
    <section className="work-app-screen work-office-shell">
      <header className="work-topbar">
        <button type="button" onClick={onClose} aria-label="返回主页"><ChevronLeft size={21} /></button>
        <button type="button" onClick={() => setView("settings")} aria-label="工作设置"><Ellipsis size={24} /></button>
      </header>
      <OfficeScene sceneRef={sceneRef} occupants={occupants} meMovement={meMovement} onObjectClick={moveMe} />
      <nav className="work-bottom-nav" aria-label="工作导航">
        <button className="nav-projects" type="button" onClick={() => setView("projects")}><FolderKanban size={24} /><span>项目管理</span></button>
        <button className="is-wide nav-timer" type="button" onClick={() => setView("timer")} aria-label="工作倒计时"><Timer size={27} /><strong>02:45:30</strong><span>工作倒计时</span></button>
        <button className="nav-employees" type="button" onClick={() => setView("employees")}><UsersRound size={25} /><span>员工管理</span></button>
      </nav>
      {notice && <div className="work-notice" role="status">{notice}</div>}
    </section>
  );
}
