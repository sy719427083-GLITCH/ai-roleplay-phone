import { OFFICE_DESKS } from './officeSceneLayout.js';

const CENTER = 420;
const homeLocations = Object.fromEntries(OFFICE_DESKS.map(({id,avatar:[x,y]}) => {
  const point=[x+40,y+110];
  return [id,{point,via:[point,[CENTER,point[1]]]}];
}));
export const LOCATIONS = {
  ...homeLocations,
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
const workLines=['整理工作资料','核对报表','回复工作消息','准备项目文档','梳理今天的安排','专心处理工作'];
export function createOfficeLife(seed=Date.now()) {
  return {now:0,seed:Number(seed)>>>0,nextEventAt:2300,eventIndex:0,serial:0,actors:OFFICE_DESKS.map(({id},i)=>({
    id,phase:'working',task:'work',location:id,destination:id,group:null,readyAt:i*450,workLine:workLines[i%workLines.length],
  }))};
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
  const available=s.actors.filter(a=>a.phase==='working'&&a.readyAt<=s.now);
  const kind=['coffee','chat','printer','chat'][s.eventIndex%4];
  s.eventIndex+=1;
  s.nextEventAt=s.eventIndex===1?6500:s.now+between(s,8500,13000);
  if(kind!=='chat' && s.actors.some(a=>a.task===kind&&['walking','active'].includes(a.phase)))return;
  const selected=[];
  const candidates=available.slice();
  const count=kind==='chat'?(random(s)<.5?2:3):1;
  while(candidates.length&&selected.length<count){
    const [candidate]=candidates.splice(Math.floor(random(s)*candidates.length),1);
    if(kind!=='chat'||!selected.some(a=>identities.get(a.id)===identities.get(candidate.id)))selected.push(candidate);
  }
  if(!selected.length || (kind==='chat'&&selected.length<2))return;
  // Only one conversational group can use the shared floor at a time.
  if(kind==='chat'&&s.actors.some(a=>a.task==='chat'&&a.phase!=='working'))return;
  const duration=kind==='coffee'?between(s,14000,21000):kind==='printer'?between(s,10000,16000):between(s,12000,21000);
  const group=kind==='chat'?`chat-${++s.serial}`:null;
  selected.forEach((actor,index)=>{
    const destination=kind==='chat'?`chat-${index}`:kind;
    s.actors=s.actors.map(a=>a.id===actor.id?travel({...a,task:kind,group,duration},a.id,destination,s.now):a);
  });
}
export function advanceOfficeLife(state,delta,roster=[]) {
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
    if(a.cancelChat&&['waiting','active'].includes(a.phase))return travel(a,a.location,a.id,s.now,'returning');
    if(a.cancelChat&&a.phase==='walking'&&s.now>=a.arriveAt)return travel(a,a.destination,a.id,s.now,'returning');
    if(a.phase==='walking'&&s.now>=a.arriveAt)return {...a,location:a.destination,phase:a.task==='chat'?'waiting':'active',until:s.now+a.duration,activityStarted:s.now};
    if(a.phase==='returning'&&s.now>=a.arriveAt)return {...a,location:a.id,destination:a.id,phase:'working',task:'work',group:null,cancelChat:false,readyAt:s.now+between(s,12000,26000),workLine:workLines[Math.floor(random(s)*workLines.length)]};
    if(a.phase==='active'&&s.now>=a.until)return travel(a,a.location,a.id,s.now,'returning');
    return a;
  });
  for(const group of new Set(s.actors.filter(a=>a.phase==='waiting').map(a=>a.group))){
    const members=s.actors.filter(a=>a.group===group);
    if(members.length>=2&&members.every(a=>a.phase==='waiting'))s.actors=s.actors.map(a=>a.group===group?{...a,phase:'active',activityStarted:s.now,until:s.now+a.duration}:a);
  }
  if(s.now>=s.nextEventAt)dispatch(s,roster);
  return s;
}
export function officeActorStatus(actor,state,roster) {
  if(actor.phase==='working')return actor.workLine;
  if(actor.phase==='returning')return actor.task==='coffee'?'端着咖啡回工位':actor.task==='printer'?'拿着文件回工位':'聊完了，回去工作';
  if(actor.cancelChat&&actor.phase==='walking')return '结束聊天，准备回工位';
  if(actor.phase==='walking')return actor.task==='coffee'?'前往茶水吧煮咖啡':actor.task==='printer'?'前往打印机':'前往和同事聊天';
  const names=state.actors.filter(a=>a.group===actor.group&&a.id!==actor.id).map(a=>roster.find(p=>p.id===a.id)?.name || '同事');
  if(actor.phase==='waiting')return '等同事过来聊天';
  if(actor.task==='chat')return `正在聊天 · ${names.join('、')}`;
  if(actor.task==='printer')return '正在打印工作资料';
  const progress=(state.now-actor.activityStarted)/actor.duration;
  return progress<.25?'接水，准备杯子':progress<.8?'正在煮咖啡':'咖啡煮好了';
}
