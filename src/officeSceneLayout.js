// Pixel coordinates in the approved 853 × 1844 scene atlas.
// The UI strips are excluded; all object slices share this one camera.
export const OFFICE_FRAME = { width:853, height:1844, top:96, sceneHeight:1606 };
export const OFFICE_OBJECTS = [
  {id:'window',name:'办公室落地窗',box:[783,96,70,950]},
  {id:'clock',name:'办公室挂钟',box:[52,151,84,88],shape:'ellipse(49% 49% at 50% 50%)'},
  {id:'board',name:'办公白板',box:[10,257,151,246],shape:'polygon(4% 32%,89% 0,100% 68%,8% 100%)'},
  {id:'tea',name:'茶水吧台',box:[173,100,573,310]},
  {id:'printer',name:'打印机与文件柜',box:[0,442,167,335],shape:'polygon(0 38%,38% 24%,55% 0,100% 0,98% 44%,58% 100%,0 100%)'},
  {id:'shelves',name:'办公收纳柜',box:[728,546,125,504]},
  {id:'left-shelf',name:'资料收纳柜',box:[0,883,78,434]},
  {id:'umbrellas',name:'雨伞架',box:[783,1054,70,191]},
  {id:'top-plant',name:'窗边绿植',box:[690,355,116,185]},
  {id:'plant',name:'办公室绿植',box:[740,1443,113,250]},
  {id:'bin',name:'纸篓',box:[6,1506,97,148]},
];
export const OFFICE_DESKS = [
  {id:'boss',box:[250,399,375,241],avatar:[338,552]},
  {id:'employee-1',box:[121,697,260,225],avatar:[148,842]},
  {id:'employee-2',box:[461,698,260,225],avatar:[485,842]},
  {id:'employee-3',box:[104,968,278,245],avatar:[145,1122]},
  {id:'employee-4',box:[464,974,275,239],avatar:[486,1122]},
  {id:'employee-5',box:[98,1264,278,242],avatar:[140,1419]},
  {id:'employee-6',box:[465,1264,278,242],avatar:[491,1419]},
];
export function objectStyle({box:[x,y,width,height],shape}) {
  const f=OFFICE_FRAME;
  return {left:`${x/f.width*100}%`,top:`${(y-f.top)/f.sceneHeight*100}%`,width:`${width/f.width*100}%`,height:`${height/f.sceneHeight*100}%`,backgroundSize:`${f.width/width*100}% ${f.height/height*100}%`,backgroundPosition:`${x/(f.width-width)*100}% ${y/(f.height-height)*100}%`,clipPath:shape};
}
export function avatarStyle([x,y]) {
  return {left:`${x/OFFICE_FRAME.width*100}%`,top:`${(y-OFFICE_FRAME.top)/OFFICE_FRAME.sceneHeight*100}%`};
}
