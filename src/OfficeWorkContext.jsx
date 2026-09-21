import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { acceptOfficeProject, readOfficeJobs, settleOfficeJobs } from './officeJobs.js';
const OfficeWorkContext=createContext(null);
import { withWalletLock as locked } from './walletStore.js';
export const useOfficeWork=()=>useContext(OfficeWorkContext);
export function OfficeWorkProvider({children}){
 const [jobs,setJobs]=useState([]),[now,setNow]=useState(Date.now),[error,setError]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[actionError,setActionError]=useState('');
 const mounted=useRef(false),checking=useRef(false),accepting=useRef(false);
 const publish=next=>setJobs(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);
 const sync=async()=>{
  if(checking.current)return;checking.current=true;
  try{await locked(()=>{if(!mounted.current)return;const next=settleOfficeJobs(window.localStorage);publish(next);setReady(true);setError('');});}
  catch(e){if(mounted.current){setError(e.message);try{publish(readOfficeJobs(window.localStorage));setReady(true);}catch{setReady(false);}}}
  finally{checking.current=false;if(mounted.current)setNow(Date.now());}
 };
 useEffect(()=>{
  mounted.current=true;sync();const timer=setInterval(sync,1000);
  window.addEventListener('storage',sync);window.addEventListener('focus',sync);document.addEventListener('visibilitychange',sync);
  return()=>{mounted.current=false;clearInterval(timer);window.removeEventListener('storage',sync);window.removeEventListener('focus',sync);document.removeEventListener('visibilitychange',sync);};
 },[]);
 const accept=async id=>{
  if(accepting.current)return false;accepting.current=true;setBusy(true);
  try{await locked(()=>{if(!mounted.current)throw Error('页面已关闭，请重试');publish(acceptOfficeProject(window.localStorage,id));setNow(Date.now());});setActionError('');return true;}
  catch(e){setActionError(e.message);return false;}
  finally{accepting.current=false;setBusy(false);}
 };
 return <OfficeWorkContext.Provider value={{jobs,now,error:error||actionError,busy,ready,accept,retry:sync}}>{children}</OfficeWorkContext.Provider>;
}
