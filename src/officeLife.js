import { DESK_ACTIVITIES, SCENE_ACTIVITIES, weightedActivity } from './officeActivities.js';
import { OFFICE_DESKS } from './officeSceneLayout.js';

const CENTER = 420;
const homeLocations = Object.fromEntries(OFFICE_DESKS.map(({id,box:[x,y,w,h]}) => {
  const point=[x+w/2,y+h+35];
  return [id,{point,via:[point,[point[0],y+h+22],[CENTER,y+h+22]]}];
}));
export const LOCATIONS = {
  ...homeLocations,
  ...Object.fromEntries(OFFICE_DESKS.filter(d=>d.id!=='boss').map(({id})=>{
    const [x,y]=homeLocations[id].point;
    const point=[x+(x<CENTER?95:-95),y];
    return [`visit-${id}`,{point,via:[point,[CENTER,y]]}];
  })),
  board:{point:[190,570],via:[[190,570],[190,662],[CENTER,662]]},
  files:{point:[85,1240],via:[[85,1240],[CENTER,1240]]},
  plant:{point:[740,1590],via:[[740,1590],[740,1545],[CENTER,1545]]},
  report:{point:[550,662],via:[[550,662],[CENTER,662]]},
  coffee:{point:[210,450],via:[[210,450],[210,662],[CENTER,662]]},
  printer:{point:[90,820],via:[[90,820],[90,952],[CENTER,952]]},
  'chat-0':{point:[285,1605],via:[[285,1605],[285,1545],[CENTER,1545]]},
  'chat-1':{point:[435,1650],via:[[435,1650],[435,1545],[CENTER,1545]]},
  'chat-2':{point:[585,1605],via:[[585,1605],[585,1545],[CENTER,1545]]},
};
const distance=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
export function routeBetween(from,to) {
  const a=LOCATIONS[from],b=LOCATIONS[to];
  const points=[...a.via,...b.via.slice().reverse()];
  return points.filter((p,i)=>!i || distance(p,points[i-1])>.01);
}
const pathLength=path=>path.slice(1).reduce((sum,p,i)=>sum+distance(path[i],p),0);
const random=s=>{s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;};
const between=(s,min,max)=>min+random(s)*(max-min);
function deskActivity(s,actor) {
  const activity=weightedActivity(DESK_ACTIVITIES,()=>random(s),actor.workLine);
  return {...actor,phase:'working',task:'work',location:actor.id,destination:actor.id,group:null,cancelChat:false,visitHostId:null,
    readyAt:s.now+between(s,6000,16000),deskUntil:s.now+between(s,18000,42000),workLine:activity.label,mood:activity.kind,icon:activity.icon};
}
export function createOfficeLife(seed=Date.now(),roster=[]) {
  let s={now:0,seed:Number(seed)>>>0,nextEventAt:0,eventIndex:0,serial:0,actors:[]};
  s.actors=OFFICE_DESKS.map(({id})=>deskActivity(s,{id}));
  // Enter an already living office, with a different activity mix on each visit.
  const warmup=between(s,9000,24000);
  for(let elapsed=0;elapsed<warmup;elapsed+=100)s=advanceOfficeLife(s,100,roster);
  return s;
}
function travel(actor,from,to,now,phase='walking') {
  const path=routeBetween(from,to);
  return {...actor,phase,location:from,destination:to,path,startedAt:now,arriveAt:now+pathLength(path)/105*1000};
}
export function officeActorPosition(actor,now,reducedMotion=false) {
  if(!['walking','returning'].includes(actor.phase))return LOCATIONS[actor.location].point;
  if(reducedMotion)return LOCATIONS[actor.location].point;
  let remaining=Math.max(0,Math.min(1,(now-actor.startedAt)/(actor.arriveAt-actor.startedAt)))*pathLength(actor.path);
  for(let i=1;i<actor.path.length;i++){
    const from=actor.path[i-1],to=actor.path[i],length=distance(from,to);
    if(remaining<=length)return [from[0]+(to[0]-from[0])*remaining/length,from[1]+(to[1]-from[1])*remaining/length];
    remaining-=length;
  }
  return LOCATIONS[actor.destination].point;
}
function dispatch(s,roster) {
  const identities=new Map(roster.map(p=>[p.id,p.identity || p.id]));
  const reportBusy=s.actors.some(a=>a.task==='report'&&a.phase!=='working');
  const available=s.actors.filter(a=>a.phase==='working'&&a.readyAt<=s.now&&!(a.id==='boss'&&reportBusy));
  const options=SCENE_ACTIVITIES.filter(a=>{
    const target=a.destination||a.id;
    if(target==='report'&&!s.actors.some(p=>p.id==='boss'&&p.phase==='working'))return false;
    return !s.actors.some(p=>p.task===target&&p.phase!=='working'&&p.phase!=='returning');
  });
  if(!options.length){s.nextEventAt=s.now+3000;return;}
  let activity=weightedActivity(options,()=>random(s),s.lastActivity);
  const kind=activity.destination||activity.id;
  s.lastActivity=activity.id;
  s.eventIndex+=1;
  s.nextEventAt=s.now+between(s,4500,11000);
  if(kind!=='chat' && s.actors.some(a=>a.task===kind&&['walking','active'].includes(a.phase)))return;
  const selected=[];
  const candidates=available.filter(a=>!(kind==='report'||activity.visit)||a.id!=='boss');
  const count=activity.visit?2:kind==='chat'?(random(s)<.5?2:3):1;
  while(candidates.length&&selected.length<count){
    const [candidate]=candidates.splice(Math.floor(random(s)*candidates.length),1);
    if(kind!=='chat'||!selected.some(a=>(identities.get(a.id)||a.id)===(identities.get(candidate.id)||candidate.id)))selected.push(candidate);
  }
  if(!selected.length || (kind==='chat'&&selected.length<2))return;
  // Only one conversational group can use the shared floor at a time.
  if(kind==='chat'&&s.actors.some(a=>a.task==='chat'&&a.phase!=='working'))return;
  const duration=kind==='coffee'?between(s,14000,21000):kind==='printer'?between(s,10000,16000):between(s,12000,21000);
  const group=kind==='chat'?`chat-${++s.serial}`:null;
  const host=activity.visit?selected[0]:null;
  if(host){const name=roster.find(p=>p.id===host.id)?.name||'同事';activity={...activity,go:`去${name}工位交流`,label:`${activity.label} · ${name}工位`};}
  selected.forEach((actor,index)=>{
    const destination=host?(index===0?host.id:`visit-${host.id}`):kind==='chat'?`chat-${index}`:kind;
    s.actors=s.actors.map(a=>{
      if(a.id!==actor.id)return a;
      const member={...a,task:kind,group,duration,activity,icon:activity.icon,mood:'',visitHostId:host?.id||null};
      return host&&index===0?{...member,phase:'waiting',location:a.id,destination:a.id}:travel(member,a.id,destination,s.now);
    });
  });
}
function returnFromActivity(s,actor,from=actor.location) {
  return from===actor.id?deskActivity(s,actor):travel(actor,from,actor.id,s.now,'returning');
}
export function advanceOfficeLife(state,delta,roster=[],holdGroup=null) {
  if(!Number.isFinite(delta)||delta<=0)return state;
  const s={...state,now:state.now+Math.min(delta,250),actors:state.actors.map(a=>({...a}))};
  const identities=new Map(roster.map(p=>[p.id,p.identity || p.id]));
  const invalidGroups=new Set();
  for(const group of new Set(s.actors.filter(a=>a.group).map(a=>a.group))){
    const members=s.actors.filter(a=>a.group===group);
    if(new Set(members.map(a=>identities.get(a.id)||a.id)).size<members.length)invalidGroups.add(group);
  }
  s.actors=s.actors.map(a=>{
    if(a.group&&invalidGroups.has(a.group))a={...a,cancelChat:true};
    if(a.cancelChat&&['waiting','active'].includes(a.phase))return returnFromActivity(s,a);
    if(a.cancelChat&&a.phase==='walking'&&s.now>=a.arriveAt)return returnFromActivity(s,a,a.destination);
    if(a.phase==='walking'&&s.now>=a.arriveAt)return {...a,location:a.destination,phase:a.task==='chat'?'waiting':'active',until:s.now+a.duration,activityStarted:s.now};
    if(a.phase==='returning'&&s.now>=a.arriveAt)return deskActivity(s,a);
    if(a.phase==='working'&&a.pendingTask){const task=a.pendingTask;return {...a,pendingTask:null,workLine:task.text,icon:'📋',mood:'work',readyAt:s.now+22000,deskUntil:s.now+35000};}
    if(a.phase==='working'&&s.now>=a.deskUntil)return deskActivity(s,a);
    if(a.phase==='active'&&s.now>=a.until&&(!holdGroup||a.group!==holdGroup))return returnFromActivity(s,a);
    return a;
  });
  for(const group of new Set(s.actors.filter(a=>a.phase==='waiting').map(a=>a.group))){
    const members=s.actors.filter(a=>a.group===group);
    if(members.length>=2&&members.every(a=>a.phase==='waiting'))s.actors=s.actors.map(a=>a.group===group?{...a,phase:'active',activityStarted:s.now,until:s.now+a.duration}:a);
  }
  if(s.now>=s.nextEventAt)dispatch(s,roster);
  return s;
}
// Keep richer activity context for dialogue; show only the concrete action above avatars.
export function officeActorStatus(actor,state) {
  const plain=text=>(text||'').replace(/^(?:摸鱼|.*?安排)[:：]\s*/,'').split(' · ')[0].replace(/^正在/,'').replace(/^工位合作$/,'合作').replace(/^工位请教$/,'请教问题').replace(/^工位闲聊$/,'闲聊');
  if(actor.phase==='working')return plain(actor.workLine);
  if(actor.phase==='returning'||actor.cancelChat&&actor.phase==='walking')return '返回工位';
  if(actor.phase==='walking'){
    const destination=actor.activity?.destination||actor.activity?.id;
    return {coffee:'前往茶水吧',tea:'前往茶水吧',water:'前往茶水吧',printer:'前往打印机',board:'前往白板',files:'查找资料',plant:'照料绿植',report:'汇报进度',chat:'找同事交流'}[destination]||'前往活动地点';
  }
  if(actor.phase==='waiting')return '等待同事';
  if(actor.task==='chat')return plain(actor.activity?.label||'聊天');
  const progress=(state.now-actor.activityStarted)/actor.duration;
  return plain(actor.activity.lines[progress<.25?0:progress<.8?1:2]);
}

export function assignOfficeTask(state,managerId,employeeId,text,roster) {
  const manager=roster.find(p=>p.id===managerId),employee=roster.find(p=>p.id===employeeId);
  if(!manager||!employee||!['boss','supervisor'].includes(manager.role)||employee.managerId!==managerId||managerId===employeeId||typeof text!=='string'||!text.trim())return state;
  return {...state,actors:state.actors.map(a=>a.id===employeeId?{...a,pendingTask:{text:`${manager.name}安排：${text.slice(0,60)}`}}:a)};
}
