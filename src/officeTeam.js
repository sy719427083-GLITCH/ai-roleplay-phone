import { OFFICE_SEATS } from './officeProfiles.js';
export const OFFICE_TEAM_KEY='ccat-office-team-v1';
const workers=OFFICE_SEATS.filter(id=>id!=='boss');
export const OFFICE_TASKS=['整理工作资料','核对报表数据','准备项目方案','检查项目进度','整理会议纪要'];
export function normalizeOfficeTeam(value={}) {
  const roles=Object.fromEntries(workers.map(id=>[id,value.roles?.[id]==='supervisor'?'supervisor':'employee']));
  const managers=Object.fromEntries(workers.map(id=>{
    const manager=value.managers?.[id];
    return [id,roles[id]==='employee'&&workers.includes(manager)&&roles[manager]==='supervisor'?manager:'boss'];
  }));
  return {version:1,mode:value.mode==='ai'?'ai':'local',roles,managers};
}
export function readOfficeTeam(storage) {
  try{return normalizeOfficeTeam(JSON.parse(storage?.getItem(OFFICE_TEAM_KEY)||'{}')||{});}catch{return normalizeOfficeTeam();}
}
export function saveOfficeTeam(storage,value) {
  const team=normalizeOfficeTeam(value);
  try{storage.setItem(OFFICE_TEAM_KEY,JSON.stringify(team));return {ok:true,team};}
  catch{return {ok:false,error:'无法保存办公室设置，请检查浏览器存储空间。'};}
}
export const officeRoleLabel=role=>role==='boss'?'老板':role==='supervisor'?'主管':'员工';
