export const OFFICE_EVENTS_KEY='ccat-office-events-v1';
export const EVENT_TYPES=[
 {id:'help',title:'有个难题想请教',text:'这部分我卡了一会儿，你能陪我一起看看吗？',choices:[['一起拆解问题','你陪我把问题拆开后，我终于找到头绪了。',2,2],['请同事一起帮忙','你帮我找了同事一起研究，事情有进展了。',1,1],['先自己试一试','我又试了一轮，还是有点担心做不好。',-1,0]]},
 {id:'client',title:'客户又改需求了',text:'客户临时加了新要求，我有点不知道怎么回复。你觉得呢？',choices:[['我来帮你沟通','你愿意出面沟通，我松了一口气。',2,2],['先列清楚影响','我们一起整理了变更影响，再商量回复。',1,1],['先把要求记下来','我先记下了新要求，等确认后再动手。',0,0]]},
 {id:'break',title:'想休息一小会儿',text:'盯着屏幕有点累了，能不能一起去喝杯东西？',choices:[['一起喝杯咖啡','你陪我歇了一会儿，感觉又有精神了。',3,1],['去吧，休息一下','你让我放心休息，我很感谢你的体谅。',2,1],['忙完这段再休息','我决定先做完这段，但确实有些疲惫。',-1,0]]},
 {id:'snack',title:'带了点零食',text:'今天带了点好吃的，要不要尝一口？',choices:[['一起分享给大家','我们把零食分给大家，办公室热闹起来了。',2,2],['尝一口，谢谢你','你认真道了谢，我觉得这份心意被接住了。',2,1],['留着你自己吃吧','你让我自己留着，我把零食收了起来。',0,0]]},
 {id:'game',title:'发现一个小游戏',text:'这个小游戏挺有意思，要不要陪我玩一局？',choices:[['就玩一局','你陪我玩了一局，短暂放松了一下。',3,1],['下班一起玩','我们约好下班再玩，我开始期待下班了。',1,2],['先专心工作','你提醒我先工作，我把游戏关掉了。',-1,0]]},
 {id:'idea',title:'有一个新想法',text:'我想到一个不同的做法，但还不太成熟。你愿意听听吗？',choices:[['说来听听','你认真听完了我的想法，我更敢开口了。',2,2],['先画个草图一起看','你建议先画草图，我们有了具体讨论的方向。',1,1],['晚点再聊','我们把这个想法留到了稍后，我先整理笔记。',0,0]]}
];
const empty=()=>({history:[],active:null,nextAt:0});
export function readOfficeEvents(storage){try{const v=JSON.parse(storage?.getItem(OFFICE_EVENTS_KEY)||'null');if(!v||!Array.isArray(v.history))return empty();return {history:v.history.filter(h=>h&&typeof h.sourceKey==='string'&&typeof h.reply==='string').slice(-60),active:v.active&&EVENT_TYPES.some(t=>t.id===v.active.type)?v.active:null,nextAt:Number(v.nextAt)||0};}catch{return empty();}}
export function createOfficeEvent(state,person,now=Date.now(),random=Math.random){const last=state.history.filter(h=>h.sourceKey===person.sourceKey).at(-1);const pool=EVENT_TYPES.filter(t=>t.id!==last?.type);const type=pool[Math.floor(random()*pool.length)]||pool[0];return {...state,active:{id:`${now}-${person.id}`,seat:person.id,sourceKey:person.sourceKey,name:person.name,type:type.id,createdAt:now}};}
export function resolveOfficeEvent(state,eventId,choice,now=Date.now()){
 const event=state.active;if(!event||event.id!==eventId)return state;const type=EVENT_TYPES.find(t=>t.id===event.type);const option=type?.choices[choice];if(!option)return state;
 return {active:null,nextAt:now+120000,history:[...state.history,{...event,choice:option[0],reply:option[1],mood:option[2],trust:option[3],at:now}].slice(-60)};
}
export function writeOfficeEvents(storage,state){try{if(!storage)throw Error();storage.setItem(OFFICE_EVENTS_KEY,JSON.stringify(state));return '';}catch{return '经历保存失败，请重试。';}}
export function officeMemories(storage,sourceKey){return readOfficeEvents(storage).history.filter(h=>h.sourceKey===sourceKey).slice(-5).map(({choice,reply})=>({choice,reply}));}
export function officeRelationship(history,sourceKey){const list=history.filter(h=>h.sourceKey===sourceKey);const score=key=>Math.max(-10,Math.min(10,list.reduce((n,h)=>n+(Number(h[key])||0),0)));return {mood:score('mood'),trust:score('trust')};}
