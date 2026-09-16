(()=>{
  "use strict";
  const DAOS=[{
    id:"neta-operations",
    name:"NETA Operations",
    core:"juno1excmamnysxujtd2hzm343nzdwch79y5cvk5h7w6uxlrt230xqwtqkmancl",
    membership:"cw4-voting",
    description:"Operational expenses and services for NETA DAO."
  }];
  const RESTS=["https://juno-api.polkachu.com","https://juno-api.lavenderfive.com"];
  const STORE="neta-dao-workshop-mvp-v2";
  const state={address:null,member:false,votingPower:"0",daoId:DAOS[0].id,drafts:[],active:null};
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const uid=()=>crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
  const toBase64=value=>{const bytes=new TextEncoder().encode(value);let binary="";bytes.forEach(byte=>binary+=String.fromCharCode(byte));return btoa(binary)};
  const validJuno=value=>/^juno1[02-9ac-hj-np-z]{38}$/.test(value);
  function persist(){localStorage.setItem(STORE,JSON.stringify({daoId:state.daoId,drafts:state.drafts,active:state.active}))}
  function restore(){try{const x=JSON.parse(localStorage.getItem(STORE)||"{}");state.daoId=DAOS.some(dao=>dao.id===x.daoId)?x.daoId:DAOS[0].id;state.drafts=Array.isArray(x.drafts)?x.drafts:[];state.active=state.drafts.some(d=>d.id===x.active&&d.daoId===state.daoId)?x.active:state.drafts.find(d=>d.daoId===state.daoId)?.id||null}catch{localStorage.removeItem(STORE)}}
  function active(){return state.drafts.find(d=>d.id===state.active)||null}
  function selectedDao(){return DAOS.find(dao=>dao.id===state.daoId)||DAOS[0]}
  async function smart(contract,msg){
    const query=btoa(unescape(encodeURIComponent(JSON.stringify(msg))));
    const failures=[];
    for(const base of RESTS)try{const r=await fetch(`${base}/cosmwasm/wasm/v1/contract/${contract}/smart/${query}`,{cache:"no-store"});if(!r.ok)throw Error(`HTTP ${r.status}`);return (await r.json()).data}catch(e){failures.push(e.message)}
    throw Error(`Membership query failed: ${failures.join(", ")}`);
  }
  async function connect(){
    if(!window.keplr)throw Error("Keplr is not installed");
    await window.keplr.enable("juno-1");
    const signer=window.keplr.getOfflineSigner("juno-1");
    const address=(await signer.getAccounts())[0]?.address;
    if(!address)throw Error("No Juno account returned");
    const dao=selectedDao();
    const result=await smart(dao.core,{voting_power_at_height:{address,height:null}});
    state.address=address;state.votingPower=String(result.power||"0");state.member=BigInt(state.votingPower)>0n;
    renderMembership();
  }
  function renderMembership(error){
    const card=$(".membership-card"),status=$("#membershipStatus"),detail=$("#membershipDetail"),button=$("#walletButton");
    card.dataset.member=button.dataset.member=String(state.member);
    if(error){status.textContent="CHECK FAILED";detail.textContent=error;return}
    if(!state.address){status.textContent="NOT CONNECTED";detail.textContent=`Connect a Juno wallet to verify current membership in ${selectedDao().name}.`;button.textContent="CONNECT KEPLR";return}
    status.textContent=state.member?"VERIFIED DAO MEMBER":"NOT CURRENTLY A MEMBER";
    detail.textContent=`${state.address.slice(0,10)}…${state.address.slice(-6)} · voting power ${state.votingPower} in ${selectedDao().name}`;
    button.textContent=`${state.address.slice(0,8)}…${state.address.slice(-5)}`;
  }
  function blank(){return{id:uid(),daoId:state.daoId,title:"",summary:"",body:"",actions:[],versions:[],comments:[],frozen:false,author:state.address,createdAt:new Date().toISOString()}}
  function readForm(){return{title:$("#title").value.trim(),summary:$("#summary").value.trim(),body:$("#body").value.trim(),actions:[...$("#actionList").children].map(readAction)}}
  function fillForm(d){
    $("#title").value=d?.title||"";$("#summary").value=d?.summary||"";$("#body").value=d?.body||"";$("#changeLog").value="";
    $("#actionList").replaceChildren();(d?.actions||[]).forEach(addAction);toggleEmpty();renderCode();renderVersions();renderComments();
    $("#editorTitle").textContent=d?.title||"NEW PROPOSAL";$("#draftState").textContent=d?.frozen?"FROZEN":d?.versions.length?`VERSION ${d.versions.length} · LOCAL`:"UNSAVED DRAFT";
    [...$("#draftForm").elements].forEach(el=>el.disabled=Boolean(d?.frozen));$("#addAction").disabled=Boolean(d?.frozen);$("#saveRevision").disabled=Boolean(d?.frozen);$("#freezeDraft").disabled=Boolean(d?.frozen||!d?.versions.length);$("#exportDraft").disabled=!d?.versions.length;
  }
  function renderDrafts(){
    const list=$("#draftList");list.replaceChildren();
    const drafts=state.drafts.filter(d=>d.daoId===state.daoId);
    if(!drafts.length){list.innerHTML='<p class="empty">No local drafts for this DAO yet.</p>';return}
    drafts.forEach(d=>{const b=document.createElement("button");b.type="button";b.className=d.id===state.active?"active":"";b.innerHTML=`<b>${esc(d.title||"Untitled proposal")}</b><span>${d.frozen?"FROZEN":d.versions.length+" VERSIONS"} · LOCAL</span>`;b.onclick=()=>{state.active=d.id;persist();renderDrafts();fillForm(d)};list.append(b)})
  }
  const field=(label,name,value="",area=false)=>`<label>${label}${area?`<textarea data-field="${name}">${esc(value)}</textarea>`:`<input data-field="${name}" value="${esc(value)}">`}</label>`;
  function fieldsFor(type,a={}){
    if(type==="bank_send")return field("RECIPIENT","recipient",a.recipient)+field("DENOM","denom",a.denom||"ujuno")+field("AMOUNT (BASE UNITS)","amount",a.amount);
    if(type==="cw20_transfer")return field("CW20 CONTRACT","contract",a.contract||"juno168ctmpyppk90d34p3jjy658zf5a5l3w8wk35wht6ccqj4mr0yv8s4j5awr")+field("RECIPIENT","recipient",a.recipient)+field("AMOUNT (BASE UNITS)","amount",a.amount);
    return field("CONTRACT","contract",a.contract)+field("FUNDS JSON","funds",a.funds||"[]",true)+field("EXECUTE MESSAGE JSON","message",a.message||"{}",true);
  }
  function addAction(a={type:"bank_send"}){
    const node=$("#actionTemplate").content.firstElementChild.cloneNode(true),select=node.querySelector("[data-field=type]"),fields=node.querySelector("[data-fields]");
    select.value=a.type;fields.className="action-fields";fields.innerHTML=fieldsFor(a.type,a);select.onchange=()=>{fields.innerHTML=fieldsFor(select.value);renderCode()};node.querySelector("[data-remove]").onclick=()=>{node.remove();toggleEmpty();renderCode()};node.oninput=renderCode;$("#actionList").append(node);toggleEmpty();renderCode();
  }
  function readAction(node){const out={type:node.querySelector("[data-field=type]").value};node.querySelectorAll("[data-fields] [data-field]").forEach(el=>out[el.dataset.field]=el.value.trim());return out}
  function messageFor(a){
    if(a.type==="bank_send")return{bank:{send:{to_address:a.recipient,amount:[{denom:a.denom,amount:a.amount}]}}};
    if(a.type==="cw20_transfer")return{wasm:{execute:{contract_addr:a.contract,msg:toBase64(JSON.stringify({transfer:{recipient:a.recipient,amount:a.amount}})),funds:[]}}};
    let message,funds;try{message=JSON.parse(a.message)}catch{message={ERROR:"INVALID EXECUTE JSON"}}try{funds=JSON.parse(a.funds||"[]")}catch{funds=[{ERROR:"INVALID FUNDS JSON"}]}
    return{wasm:{execute:{contract_addr:a.contract,msg:toBase64(JSON.stringify(message)),funds}}};
  }
  function renderCode(){const actions=[...$("#actionList").children].map(readAction);$("#codeOutput").textContent=JSON.stringify({messages:actions.map(messageFor)},null,2);$("#toggleCode").innerHTML=`${$("#codeOutput").hidden?"SHOW":"HIDE"} TRANSACTION CODE <span>⌄</span>`}
  function toggleEmpty(){$("#emptyActions").hidden=$("#actionList").children.length>0}
  function saveRevision(){
    const values=readForm();if(!values.title||!values.summary||!values.body){$("#draftForm").reportValidity();return}
    const error=validateActions(values.actions);if(error){alert(error);return}
    let d=active();if(!d){d=blank();state.drafts.unshift(d);state.active=d.id}
    const changeLog=$("#changeLog").value.trim();if(d.versions.length&&!changeLog){alert("Explain what changed and why before saving a new version.");return}
    Object.assign(d,values);d.author=d.author||state.address;d.versions.push({number:d.versions.length+1,createdAt:new Date().toISOString(),changeLog:changeLog||"Initial proposal draft",snapshot:structuredClone(values)});
    persist();renderDrafts();fillForm(d);
  }
  function validateActions(actions){
    for(const [index,a] of actions.entries()){
      const label=`Action ${index+1}`;
      if(a.type==="bank_send"&&(!validJuno(a.recipient)||!/^\d+$/.test(a.amount)||!a.denom))return `${label}: enter a valid Juno recipient, base-unit amount and denom.`;
      if(a.type==="cw20_transfer"&&(!validJuno(a.contract)||!validJuno(a.recipient)||!/^\d+$/.test(a.amount)))return `${label}: enter valid Juno contract/recipient addresses and a base-unit amount.`;
      if(a.type==="wasm_execute"){
        if(!validJuno(a.contract))return `${label}: enter a valid Juno contract address.`;
        try{JSON.parse(a.message)}catch{return `${label}: execute message must be valid JSON.`}
        try{const funds=JSON.parse(a.funds||"[]");if(!Array.isArray(funds))throw Error()}catch{return `${label}: funds must be a valid JSON array.`}
      }
    }
    return "";
  }
  async function freeze(){
    const d=active();if(!d?.versions.length||!confirm("Freeze this exact version? It can no longer be edited in this MVP."))return;
    const canonical=JSON.stringify(d.versions.at(-1).snapshot);const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(canonical));
    d.frozen=true;d.frozenHash=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");persist();renderDrafts();fillForm(d);
  }
  function exportDraft(){
    const d=active();if(!d?.versions.length)return;
    const artifact={format:"neta-dao-proposal-draft-v1",exportedAt:new Date().toISOString(),draft:d,transactionPayload:{messages:d.actions.map(messageFor)}};
    const blob=new Blob([JSON.stringify(artifact,null,2)],{type:"application/json"}),link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`neta-dao-proposal-${d.id}.json`;link.click();URL.revokeObjectURL(link.href);
  }
  function renderVersions(){const d=active(),list=$("#versionList");list.replaceChildren();(d?.versions||[]).slice().reverse().forEach(v=>{const x=document.createElement("div");x.className="version-item";x.innerHTML=`<b>VERSION ${v.number}</b><p>${esc(v.changeLog)}</p><small>${new Date(v.createdAt).toLocaleString()}</small>`;list.append(x)});if(!d?.versions.length)list.innerHTML='<p class="empty">Save the first version to begin an audit trail.</p>'}
  function compare(){
    const d=active();if(!d||d.versions.length<2){alert("At least two versions are required.");return}
    const a=JSON.stringify(d.versions.at(-2).snapshot,null,2).split("\n"),b=JSON.stringify(d.versions.at(-1).snapshot,null,2).split("\n"),out=[];const max=Math.max(a.length,b.length);
    for(let i=0;i<max;i++){if(a[i]===b[i])out.push("  "+(a[i]||""));else{if(a[i]!==undefined)out.push("- "+a[i]);if(b[i]!==undefined)out.push("+ "+b[i])}}
    const el=$("#diffOutput");el.textContent=out.join("\n");el.hidden=false;
  }
  function renderComments(){const d=active(),list=$("#commentList");list.replaceChildren();(d?.comments||[]).forEach(c=>{const x=document.createElement("div");x.className="comment";x.innerHTML=`<p>${esc(c.body)}</p><small>${esc(c.author.slice(0,10)+"…"+c.author.slice(-6))} · VERSION ${c.version} · ${new Date(c.createdAt).toLocaleString()}</small>`;list.append(x)});if(!d?.comments.length)list.innerHTML='<p class="empty">No local review comments yet.</p>';$("#commentBody").disabled=$("#commentForm button").disabled=!state.member||!d}
  function renderDaoPicker(query=""){
    const term=query.trim().toLowerCase(),matches=DAOS.filter(dao=>!term||dao.name.toLowerCase().includes(term)||dao.core.includes(term));
    $("#daoOptions").innerHTML=DAOS.map(dao=>`<option value="${esc(dao.name)}">${esc(dao.core)}</option>`).join("");
    const result=$("#daoResult");result.replaceChildren();
    matches.forEach(dao=>{const button=document.createElement("button");button.type="button";button.className=dao.id===state.daoId?"selected":"";button.innerHTML=`<strong>${esc(dao.name)}</strong><span>${esc(dao.description)}</span><small>${esc(dao.core.slice(0,13)+"…"+dao.core.slice(-8))} · REVIEWED</small>`;button.onclick=()=>selectDao(dao.id);result.append(button)});
    if(!matches.length)result.innerHTML='<p class="empty">No whitelisted DAO matches this search.</p>';
  }
  async function selectDao(id){
    if(!DAOS.some(dao=>dao.id===id))return;state.daoId=id;state.active=state.drafts.find(d=>d.daoId===id)?.id||null;state.member=false;state.votingPower="0";persist();renderDaoPicker($("#daoSearch").value);renderDrafts();fillForm(active());renderMembership();
    if(state.address)try{const result=await smart(selectedDao().core,{voting_power_at_height:{address:state.address,height:null}});state.votingPower=String(result.power||"0");state.member=BigInt(state.votingPower)>0n;renderMembership();renderComments()}catch(e){renderMembership(e.message)}
  }
  $("#walletButton").onclick=()=>connect().then(renderComments).catch(e=>renderMembership(e.message));
  $("#newDraft").onclick=()=>{state.active=null;renderDrafts();fillForm(null)};
  $("#addAction").onclick=()=>addAction();
  $("#saveRevision").onclick=saveRevision;$("#freezeDraft").onclick=freeze;$("#exportDraft").onclick=exportDraft;$("#compareVersions").onclick=compare;
  $("#toggleCode").onclick=()=>{$("#codeOutput").hidden=!$("#codeOutput").hidden;renderCode()};
  $("#commentForm").onsubmit=e=>{e.preventDefault();const d=active(),body=$("#commentBody").value.trim();if(!state.member||!d||!body)return;d.comments.push({id:uid(),body,author:state.address,version:d.versions.length,createdAt:new Date().toISOString()});$("#commentBody").value="";persist();renderComments()};
  $("#daoSearch").oninput=e=>renderDaoPicker(e.target.value);
  restore();renderDaoPicker();renderMembership();renderDrafts();fillForm(active());
})();
