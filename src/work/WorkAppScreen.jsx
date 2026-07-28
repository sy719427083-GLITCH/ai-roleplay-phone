import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ChevronLeft, Ellipsis, FolderKanban, Timer, UsersRound } from "lucide-react";
import { parseConfigs, STORAGE_KEY } from "../apiConfig.js";
import { addWalletIncomeOnce } from "../walletStore.js";
import { EmployeeManager } from "./EmployeeManager.jsx";
import { OfficeScene } from "./OfficeScene.jsx";
import { ProjectCountdownView } from "./ProjectCountdownView.jsx";
import { ProjectManagementPreview } from "./ProjectManagementPreview.jsx";
import { WorkCompanyOnboarding } from "./WorkCompanyOnboarding.jsx";
import { WorkSettings } from "./WorkSettings.jsx";
import { formatOfficeAiError, testOfficeAiDirector } from "./officeConversation.js";
import { readOfficeProfiles } from "./officeProfiles.js";
import { OFFICE_STORAGE_KEY, officeReducer, resolveOfficeAvatar, restoreOfficeState } from "./officeState.js";
import {
  WORK_COMPANY_STORAGE_KEY,
  createWorkCompany,
  restoreWorkCompany,
  serializeWorkCompany,
} from "./workCompanyState.js";
import {
  WORK_PROJECTS_STORAGE_KEY,
  clearCompletedWorkProject,
  restoreWorkProjectState,
  serializeWorkProjectState,
} from "./workProjectState.js";
import { createProjectRewardId, deriveProjectTimer } from "./workProjectTimer.js";
import { useOfficeSimulation } from "./useOfficeSimulation.js";
import "./office.css";

const VIEW_TITLES = { settings: "工作设置", timer: "项目倒计时", employees: "员工管理" };

export function WorkAppScreen({ onClose }) {
  const profiles = useMemo(() => readOfficeProfiles(), []);
  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.id, profile])), [profiles]);
  const [company, setCompany] = useState(() => restoreWorkCompany(window.localStorage.getItem(WORK_COMPANY_STORAGE_KEY)));
  const [state, dispatch] = useReducer(officeReducer, null, () => restoreOfficeState(window.localStorage.getItem(OFFICE_STORAGE_KEY), profiles));
  const [projectState, setProjectState] = useState(() => restoreWorkProjectState(window.localStorage.getItem(WORK_PROJECTS_STORAGE_KEY)));
  const [view, setView] = useState("office");
  const [notice, setNotice] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [claiming, setClaiming] = useState(false);
  const [rewardError, setRewardError] = useState("");
  const sceneRef = useRef(null);
  const noticeTimer = useRef(null);

  const occupants = useMemo(() => Object.entries(state.assignments).flatMap(([slotId, profileId]) => {
    const profile = profileMap.get(profileId);
    return profile ? [{ slotId, profile, avatar: resolveOfficeAvatar(profile, state.avatarOverrides) }] : [];
  }), [profileMap, state.assignments, state.avatarOverrides]);
  const projectTimer = deriveProjectTimer(projectState, now);

  useEffect(() => {
    window.localStorage.setItem(OFFICE_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    window.localStorage.setItem(WORK_PROJECTS_STORAGE_KEY, serializeWorkProjectState(projectState));
  }, [projectState]);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => () => {
    window.clearTimeout(noticeTimer.current);
  }, []);

  const showNotice = (text, durationMs = 2200) => {
    setNotice(text);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), durationMs);
  };

  const { characterStates, activeConversation, commandMe } = useOfficeSimulation({ occupants, simulation: state.simulation, dispatch, companyName: company?.name, projectContext: projectTimer.project?.name || "", sceneRef, now, showNotice });

  const claimReward = () => {
    if (claiming || projectTimer.status !== "finished") return;
    setClaiming(true);
    setRewardError("");
    try {
      addWalletIncomeOnce({
        id: createProjectRewardId(projectState),
        amount: projectTimer.project.amountValue,
        desc: `项目报酬 · ${projectTimer.project.name}`,
      });
      setProjectState((current) => clearCompletedWorkProject(current, Date.now()));
      setNow(Date.now());
    } catch (error) {
      setRewardError(error instanceof Error ? error.message : "报酬领取失败，请重试");
    } finally {
      setClaiming(false);
    }
  };

  const persistCompany = (prefix) => {
    const nextCompany = createWorkCompany(prefix);
    window.localStorage.setItem(WORK_COMPANY_STORAGE_KEY, serializeWorkCompany(nextCompany));
    return nextCompany;
  };

  const testAiDirector = async () => {
    const apiState = parseConfigs(window.localStorage.getItem(STORAGE_KEY));
    try {
      return await testOfficeAiDirector({ apiState });
    } catch (testError) {
      throw new Error(formatOfficeAiError(testError));
    }
  };

  if (!company) {
    return (
      <WorkCompanyOnboarding
        onClose={onClose}
        onCreate={persistCompany}
        onComplete={setCompany}
      />
    );
  }

  if (view === "settings") {
    return <WorkSettings simulationMode={state.simulation.mode} onSimulationModeChange={(mode) => dispatch({ type: "SET_SIMULATION_MODE", mode })} onTestAiDirector={testAiDirector} onBack={() => setView("office")} onCleared={onClose} />;
  }

  if (view === "projects") {
    return (
      <ProjectManagementPreview
        onBack={() => setView("office")}
        projectState={projectState}
        onProjectStateChange={(nextState) => { setProjectState(nextState); setNow(Date.now()); }}
      />
    );
  }

  if (view === "timer") {
    return (
      <ProjectCountdownView
        timer={projectTimer}
        endsAt={projectState.endsAt}
        claiming={claiming}
        error={rewardError}
        onBack={() => setView("office")}
        onOpenProjects={() => setView("projects")}
        onClaim={claimReward}
      />
    );
  }

  if (view !== "office") {
    return (
      <section className="work-app-screen work-subpage">
        <header className="work-page-header"><button type="button" onClick={() => setView("office")} aria-label="返回办公室"><ChevronLeft size={21} /></button><h1>{VIEW_TITLES[view]}</h1><span /></header>
        {view === "employees" ? <EmployeeManager profiles={profiles} state={state} dispatch={dispatch} onError={showNotice} /> : <section className="work-placeholder-page"><div className="work-placeholder-mark">S</div><h2>{VIEW_TITLES[view]}</h2><p>暂时留空</p></section>}
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
      <OfficeScene
        sceneRef={sceneRef}
        occupants={occupants}
        characterStates={characterStates}
        activeConversation={activeConversation}
        onObjectClick={commandMe}
      />
      <nav className="work-bottom-nav" aria-label="工作导航">
        <button className="nav-projects" type="button" onClick={() => setView("projects")}><FolderKanban size={24} /><span>项目管理</span></button>
        <div className={`work-timer-nav is-${projectTimer.status}`}>
          <button className="is-wide nav-timer" type="button" onClick={() => setView("timer")} aria-label="项目倒计时">
            <Timer size={27} /><strong>{projectTimer.display}</strong><span>{projectTimer.status === "finished" ? "工作结束" : "项目倒计时"}</span>
          </button>
          {projectTimer.status === "finished" && <button className="work-reward-claim-small" type="button" onClick={claimReward} disabled={claiming}>{claiming ? "正在领取" : "点击领取报酬"}</button>}
        </div>
        <button className="nav-employees" type="button" onClick={() => setView("employees")}><UsersRound size={25} /><span>员工管理</span></button>
      </nav>
      {notice && <div className="work-notice" role="status">{notice}</div>}
    </section>
  );
}
