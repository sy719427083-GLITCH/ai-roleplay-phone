// Ambient scene activities only: these labels do not create messages or work records.
export const DESK_ACTIVITIES = [
  ...['整理工作资料','核对报表数据','回复工作邮件','填写项目表格','撰写项目方案','修改宣传文案','制作演示文稿','检查项目进度','整理会议纪要','检查文件错字','规划明天的任务','准备汇报材料'].map(label=>({label,kind:'work',icon:'📄',weight:5})),
  ...['思考新的方案','记录突然的灵感','查看今日待办'].map(label=>({label,kind:'think',icon:'💡',weight:3})),
  ...['伸个懒腰','喝一口水','望着窗外发会儿呆'].map(label=>({label,kind:'rest',icon:'☕',weight:2})),
  {label:'摸鱼：看电视剧',kind:'tv',icon:'📺',weight:3},
  {label:'摸鱼：刷抖音',kind:'video',icon:'📱',weight:3},
  {label:'摸鱼：玩一局游戏',kind:'game',icon:'🎮',weight:3},
];
export const SCENE_ACTIVITIES = [
  {id:'coffee',weight:3,icon:'☕',lines:['接水，准备杯子','正在煮咖啡','端起刚煮好的咖啡'],go:'去茶水吧煮咖啡',back:'端着咖啡回工位'},
  {id:'tea',destination:'coffee',weight:2,icon:'🍵',lines:['挑选茶包','正在泡茶','茶泡好了'],go:'去茶水吧泡茶',back:'端着茶回工位'},
  {id:'water',destination:'coffee',weight:2,icon:'💧',lines:['拿出水杯','正在接水','盖好水杯'],go:'去茶水吧接水',back:'拿着水杯回工位'},
  {id:'printer',weight:4,icon:'🖨️',lines:['整理要打印的文件','正在打印工作资料','整理打印稿'],go:'前往打印机',back:'拿着文件回工位'},
  {id:'copy',destination:'printer',weight:2,icon:'📑',lines:['摆好原稿','正在复印资料','收好复印件'],go:'去复印工作资料',back:'拿着复印件回工位'},
  {id:'board',weight:3,icon:'📝',lines:['擦拭白板','在白板上写计划','检查白板上的安排'],go:'去白板整理计划',back:'写完计划回工位'},
  {id:'files',weight:3,icon:'📚',lines:['查找资料','整理归档文件','把资料放回柜子'],go:'去资料柜找文件',back:'整理完资料回工位'},
  {id:'plant',weight:1,icon:'🌱',lines:['检查盆土','给绿植浇水','收好浇水壶'],go:'去照料办公室绿植',back:'浇完水回工位'},
  ...['讨论项目方案','交流工作进度','请教工作问题','一起检查文件','研究遇到的问题','聊聊刚才的趣事'].map((label,i)=>({id:`chat-${i}`,destination:'chat',weight:i===5?1:3,icon:'💬',label,go:'去找同事交流',back:'交流结束，回工位'})),
  ...['工位合作','工位请教','工位闲聊'].map((label,i)=>({id:`visit-${i}`,destination:'chat',visit:true,weight:5,icon:'💬',label,go:'去同事工位交流',back:'交流结束，回工位'})),
  {id:'report',weight:2,icon:'📋',lines:['准备好汇报资料','向老板汇报进度','确认下一步安排'],go:'去老板桌前汇报',back:'汇报结束回工位'},
];
export function weightedActivity(items,random,previous) {
  const choices=items.filter(a=>(a.id||a.label)!==previous);
  let value=random()*choices.reduce((sum,a)=>sum+a.weight,0);
  return choices.find(a=>(value-=a.weight)<0)||choices.at(-1);
}
