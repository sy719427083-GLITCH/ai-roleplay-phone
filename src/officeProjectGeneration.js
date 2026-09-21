import { openProjectBoard, refreshProjectBoard, freeRefreshes, REFRESH_COST } from './officeProjects.js';
import { requestOfficeProjects } from './officeProjectApi.js';
import { readWalletData, withWalletLock } from './walletStore.js';
const check=signal=>{if(signal?.aborted)throw new DOMException('生成已取消','AbortError');};
export async function generateOfficeProjectBoard({storage,signal,fetchImpl,lock=withWalletLock}){
 const previous=await lock(()=>{check(signal);const b=openProjectBoard(storage);if(b.source==='ai'&&!freeRefreshes(b)&&readWalletData(storage,{strict:true}).balance<REFRESH_COST)throw new Error('钱包余额不足，需要 200 才能刷新');return b;});
 const history=[...(previous.history||[]),...previous.projects].slice(-50);
 const projects=await requestOfficeProjects({storage,history,signal,fetchImpl});
 check(signal);
 try{return await lock(()=>{check(signal);return refreshProjectBoard(storage,Date.now(),projects,previous.batchId||'legacy');});}
 catch(error){if(error.name!=='AbortError')error.needsRecovery=true;throw error;}
}
