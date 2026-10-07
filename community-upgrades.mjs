try{
 const response=await fetch('/data/community-upgrades.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Unavailable');
 const data=await response.json(),cards=[];
 for(const upgrade of data.upgrades||[]){
  if(!/^[a-z0-9-]+$/.test(upgrade.id)||upgrade.path!==`/community-tools/validator-upgrades/${upgrade.id}/`)continue;
  const a=document.createElement('a');a.className='tool-card';a.href=upgrade.path;
  for(const [tag,content,className] of [['span',upgrade.date,'tool-tag'],['h2',upgrade.title,''],['p','Upgrade at block '+Number(upgrade.height).toLocaleString('en-US')+'.'+(upgrade.tracking?.status==='closed'?' Monitoring ended after '+upgrade.tracking.windowSeconds/3600+' hours.':''),''],['span','View validator status →','tool-action']]){const el=document.createElement(tag);el.textContent=content;el.className=className;a.append(el);}cards.push(a);
 }
 if(cards.length)document.getElementById('upgrade-list').replaceChildren(...cards);
}catch{/* The first published upgrade remains available without a registry read. */}
