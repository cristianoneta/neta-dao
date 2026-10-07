// Public historical evidence. Unknown and unscanned records are never zero delays.
export function parseUpgradeHistory(data,upgrade){
 const hash=/^[A-F0-9]{64}$/,address=/^[A-F0-9]{40}$/;
 if(data?.schema!==1||data.upgradeId!==upgrade.id||data.chainId!==upgrade.chainId||data.upgradeHeight!==upgrade.height||!Number.isSafeInteger(data.scannedThrough)||data.scannedThrough<upgrade.height||!hash.test(data.scannedHash)||data.halt?.height!==upgrade.height||!hash.test(data.halt.hash)||!Number.isFinite(Date.parse(data.halt.time))||!Number.isFinite(Date.parse(data.updatedAt))||!Array.isArray(data.validators)||data.validators.length<1||data.validators.length>100)throw Error('Invalid upgrade history.');
 const seen=new Set(),records=new Map(),halt=Date.parse(data.halt.time);
 for(const validator of data.validators){
  if(!address.test(validator.address)||seen.has(validator.address)||!Object.hasOwn(data.firstSignatures||{},validator.address))throw Error('Invalid historical validator.');seen.add(validator.address);
  const record=data.firstSignatures[validator.address];
  if(record===null){records.set(validator.address,null);continue;}
  const seconds=Math.floor((Date.parse(record?.timestamp)-halt)/1000);
  if(!Number.isSafeInteger(record?.height)||record.height<=upgrade.height||record.height>data.scannedThrough||!hash.test(record.blockHash)||!Number.isSafeInteger(record.secondsFromHalt)||record.secondsFromHalt<0||Math.abs(record.secondsFromHalt-seconds)>1||record.blocksAfterRestart!==record.height-upgrade.height-1||!/^[A-Za-z0-9+/]{86}==$/.test(record.signature))throw Error('Invalid first signature record.');
  records.set(validator.address,record);
 }
 if(Object.keys(data.firstSignatures).length!==seen.size||data.complete!==[...records.values()].every(Boolean))throw Error('Incomplete history identities.');
 return {...data,records};
}
export function duration(seconds){
 if(!Number.isFinite(seconds)||seconds<0)return '—';
 const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=Math.floor(seconds%60);
 return (h?h+'h ':'')+(m||h?m+'m ':'')+s+'s';
}
