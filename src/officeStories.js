export const OFFICE_STORIES_KEY='ccat-office-stories-v1';
export const STORY_ACTIONS={coffee:'一起喝咖啡',cooperate:'一起处理问题',work:'各自返回工作'};
export function readOfficeStories(storage){try{const value=JSON.parse(storage?.getItem(OFFICE_STORIES_KEY)||'[]');return Array.isArray(value)?value.filter(s=>s&&typeof s.id==='string'&&Array.isArray(s.participants)&&Array.isArray(s.messages)&&STORY_ACTIONS[s.action]).slice(-40):[];}catch{return [];}}
export function saveOfficeStory(storage,story){try{const records=readOfficeStories(storage);const next=[...records.filter(s=>s.id!==story.id),story].slice(-40);storage.setItem(OFFICE_STORIES_KEY,JSON.stringify(next));return next;}catch{return null;}}
export function storyMemories(storage,sourceKey){return readOfficeStories(storage).filter(s=>s.participants.some(p=>p.sourceKey===sourceKey)).slice(-5).map(s=>({people:s.participants.map(p=>p.name),decision:STORY_ACTIONS[s.action],status:s.status,topic:s.topic}));}
export function localOfficeStory(participants,topic,storage,random=Math.random){
 const previous=storyMemories(storage,participants[0]?.sourceKey).at(-1);
 const leisure=/闲聊|趣事|休息|咖啡/.test(topic);
 const action=leisure?(random()<.8?'coffee':'work'):(random()<.75?'cooperate':'work');
 const first=participants[0],second=participants[1];if(!first||!second)throw Error('自主交流需要两位不同角色。');
 const lines=[{speaker:first.id,text:leisure?'刚才忙了好一阵，想换个地方歇一下。':'我手头有个地方没理清，想听听你的看法。'},
 {speaker:second.id,text:previous?`上次和${previous.people.filter(n=>n!==second.name).join('、')}的交流还有印象，这次也一起看看吧。`:'好，你说说看，我听着。'},
 ...participants.slice(2).map(p=>({speaker:p.id,text:'我也在，看看有没有能帮忙的地方。'})),
 {speaker:first.id,text:action==='coffee'?'要不一起去茶水吧，边喝边聊？':action==='cooperate'?'我们到工位一起理一遍吧，可能更清楚。':'我先整理一下思路，再继续手头的事。'},
 {speaker:second.id,text:action==='coffee'?'走吧，一起去喝杯咖啡。':action==='cooperate'?'好，我和你一起处理。':'好，那我们各自继续，之后再交流。'}];
 return {messages:lines,action};
}
