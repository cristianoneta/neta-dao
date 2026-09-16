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
  const OWNER_TESTERS=["juno1z3xcalwan92yqxu9d406tlft9yy94jy8s5et57"];
  const STORE="neta-dao-workshop-mvp-v2";
  const state={address:null,member:false,ownerAccess:false,votingPower:"0",daoId:DAOS[0].id,drafts:[],active:null,editing:false};
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const uid=()=>crypto.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2);
  const toBase64=value=>{const bytes=new TextEncoder().encode(value);let binary="";bytes.forEach(byte=>binary+=String.fromCharCode(byte));return btoa(binary)};
  const validJuno=value=>/^juno1[02-9ac-hj-np-z]{38}$/.test(value);
  function persist(){localStorage.setItem(STORE,JSON.stringify({daoId:state.daoId,drafts:state.drafts,active:state.active}))}
  function restore(){try{const x=JSON.parse(localStorage.getItem(STORE)||"{}");state.daoId=DAOS.some(dao=>dao.id===x.daoId)?x.daoId:DAOS[0].id;state.drafts=Array.isArray(x.drafts)?x.drafts.map(d=>({...d,daoId:d.daoId||DAOS[0].id,status:d.status||"draft",actions:Array.isArray(d.actions)?d.actions:[],versions:Array.isArray(d.versions)?d.versions:[],comments:Array.isArray(d.comments)?d.comments:[]})):[];state.active=state.drafts.some(d=>d.id===x.active&&d.daoId===state.daoId)?x.active:state.drafts.find(d=>d.daoId===state.daoId)?.id||null}catch{localStorage.removeItem(STORE)}}
  function feedback(message,type="info"){$("#editorFeedback").textContent=message;$("#editorFeedback").dataset.type=type}
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
    state.address=address;state.ownerAccess=OWNER_TESTERS.includes(address);
    try{const result=await smart(selectedDao().core,{voting_power_at_height:{address,height:null}});state.votingPower=String(result.power||"0");state.member=state.ownerAccess||BigInt(state.votingPower)>0n}
    catch(error){if(!state.ownerAccess)throw error;state.votingPower="0";state.member=true}
    renderMembership();
  }
  function renderMembership(error){
    const card=$(".membership-card"),status=$("#membershipStatus"),detail=$("#membershipDetail"),button=$("#walletButton");
    card.dataset.member=button.dataset.member=String(state.member);
    if(error){status.textContent="CHECK FAILED";detail.textContent=error;return}
    if(!state.address){status.textContent="NOT CONNECTED";detail.textContent=`Connect a Juno wallet to verify current membership in ${selectedDao().name}.`;button.textContent="CONNECT KEPLR";return}
    status.textContent=state.ownerAccess?"OWNER TEST ACCESS":state.member?"VERIFIED DAO MEMBER":"NOT CURRENTLY A MEMBER";
    detail.textContent=state.ownerAccess?`${state.address.slice(0,10)}…${state.address.slice(-6)} · local MVP override`: `${state.address.slice(0,10)}…${state.address.slice(-6)} · voting power ${state.votingPower} in ${selectedDao().name}`;
    button.textContent=`${state.address.slice(0,8)}…${state.address.slice(-5)}`;
    $("#walletMenuAddress").textContent=state.address;$("#walletMenuAccess").textContent=status.textContent;
  }
  function blank(){return{id:uid(),daoId:state.daoId,title:"",summary:"",body:"",actions:[],versions:[],comments:[],status:"draft",frozen:false,author:state.address,createdAt:new Date().toISOString()}}
  function readForm(){return{title:$("#title").value.trim(),summary:$("#summary").value.trim(),body:$("#body").value.trim(),actions:[...$("#actionList").children].map(readAction)}}
  function fillForm(d){
    $("#title").value=d?.title||"";$("#summary").value=d?.summary||"";$("#body").value=d?.body||"";$("#changeLog").value="";
    $("#actionList").replaceChildren();(d?.actions||[]).forEach(addAction);toggleEmpty();renderCode();renderVersions();renderComments();
    const published=d?.status==="published",showEditor=!published||state.editing;
    $("#draftForm").hidden=!showEditor;$(".technical").hidden=!showEditor;$("#reviewSurface").hidden=!published||state.editing;
    $("#editorTitle").textContent=d?.title||"NEW PROPOSAL";$("#draftState").textContent=d?.frozen?"FROZEN":published?`PUBLISHED DRAFT · VERSION ${d.versions.length}`:d?.versions.length?`VERSION ${d.versions.length} · LOCAL`:"UNSAVED DRAFT";
    [...$("#draftForm").elements].forEach(el=>el.disabled=Boolean(d?.frozen));$("#addAction").disabled=Boolean(d?.frozen);$("#saveRevision").disabled=Boolean(d?.frozen);$("#saveRevision").hidden=!showEditor;$("#publishDraft").hidden=published||!d?.versions.length;$("#editRevision").hidden=!published||state.editing||Boolean(d?.frozen);$("#freezeDraft").disabled=Boolean(d?.frozen||!d?.versions.length);$("#exportDraft").disabled=!d?.versions.length;
    if(published&&!state.editing)renderPublished(d);
  }
  function renderDrafts(){
    const list=$("#draftList");list.replaceChildren();
    const drafts=state.drafts.filter(d=>d.daoId===state.daoId);
    if(!drafts.length){list.innerHTML='<p class="empty">No local drafts for this DAO yet.</p>';return}
    drafts.forEach(d=>{const b=document.createElement("button");b.type="button";b.className=d.id===state.active?"active":"";b.innerHTML=`<b>${esc(d.title||"Untitled proposal")}</b><span>${d.frozen?"FROZEN":d.status==="published"?"PUBLISHED · V"+d.versions.length:d.versions.length+" VERSIONS"} · LOCAL</span>`;b.onclick=()=>{state.active=d.id;state.editing=false;persist();renderDrafts();fillForm(d)};list.append(b)})
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
    if(values.summary.length>300){feedback("Keep the proposal summary within 300 characters.","error");return}
    const error=validateActions(values.actions);if(error){alert(error);return}
    let d=active();if(!d){d=blank();state.drafts.unshift(d);state.active=d.id}
    const changeLog=$("#changeLog").value.trim();if(d.versions.length&&!changeLog){alert("Explain what changed and why before saving a new version.");return}
    Object.assign(d,values);d.author=d.author||state.address;d.versions.push({number:d.versions.length+1,createdAt:new Date().toISOString(),changeLog:changeLog||"Initial proposal draft",snapshot:structuredClone(values)});
    state.editing=false;persist();feedback(`Version ${d.versions.length} saved locally.`);renderDrafts();fillForm(d);
  }
  function canAuthor(d){return Boolean(state.address&&(state.ownerAccess||d?.author===state.address))}
  function publishDraft(){
    try{
      const d=active();if(!d?.versions.length){feedback("Save the first version before opening review.","error");return}if(!state.member||!state.address){feedback("Connect a verified DAO member wallet before opening review.","error");return}
      if(d.author&&d.author!==state.address&&!state.ownerAccess){feedback("Only the draft author can open its review.","error");return}
      d.author=d.author||state.address;d.status="published";d.publishedAt=new Date().toISOString();state.editing=false;persist();renderDrafts();fillForm(d);feedback("Review opened locally. DAO members can now start discussion threads.","success");$("#reviewSurface").scrollIntoView({behavior:"smooth",block:"start"});
    }catch(error){console.error(error);feedback(`Could not open review: ${error.message}`,"error")}
  }
  function editRevision(){const d=active();if(!canAuthor(d)){alert("Only the proposal author can create a revision.");return}state.editing=true;fillForm(d);$("#changeLog").focus()}
  function renderPublished(d){
    const latest=d.versions.at(-1);$("#reviewVersion").textContent=`VERSION ${latest?.number||d.versions.length}`;$("#reviewUpdated").textContent=`UPDATED ${new Date(latest?.createdAt||d.publishedAt).toLocaleString()}`;
    $("#reviewTitle").textContent=d.title;$("#reviewSummary").textContent=d.summary;$("#reviewBody").textContent=d.body;$("#proposalDetails").open=false;
    const actions=$("#reviewActions");actions.replaceChildren();
    if(!d.actions.length)actions.innerHTML='<p class="empty">Text-only proposal. No executable actions.</p>';
    d.actions.forEach((action,index)=>{const card=document.createElement("div");card.className="review-action";card.innerHTML=`<b>ACTION ${index+1} · ${esc(action.type.replaceAll("_"," ").toUpperCase())}</b><pre>${esc(JSON.stringify(messageFor(action),null,2))}</pre>`;actions.append(card)});
    const section=$("#commentSection"),current=section.value;section.innerHTML='<option value="general">GENERAL PROPOSAL</option><option value="summary">SUMMARY</option><option value="body">FULL PROPOSAL</option>'+d.actions.map((_,index)=>`<option value="action:${index}">ACTION ${index+1}</option>`).join("");if([...section.options].some(option=>option.value===current))section.value=current;
    renderVersions();renderComments();
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
  function renderVersions(){
    const d=active(),list=$("#versionList");list.replaceChildren();
    (d?.versions||[]).forEach(v=>{const x=document.createElement("details"),snapshot=v.snapshot||{};x.className="version-item";x.innerHTML=`<summary><span><b>VERSION ${v.number}</b><small>${new Date(v.createdAt).toLocaleString()}</small></span><span>${esc(v.changeLog)}</span></summary><div class="version-expanded"><h4>${esc(snapshot.title||d.title||"Untitled proposal")}</h4><p class="version-summary">${esc(snapshot.summary||"")}</p><div class="version-body">${esc(snapshot.body||"")}</div><small>${(snapshot.actions||[]).length} EXECUTION ACTIONS</small></div>`;list.append(x)});
    if(!d?.versions.length)list.innerHTML='<p class="empty">Save the first version to begin an audit trail.</p>';
  }
  function compare(){
    const d=active();if(!d||d.versions.length<2){alert("At least two versions are required.");return}
    const a=JSON.stringify(d.versions.at(-2).snapshot,null,2).split("\n"),b=JSON.stringify(d.versions.at(-1).snapshot,null,2).split("\n"),out=[];const max=Math.max(a.length,b.length);
    for(let i=0;i<max;i++){if(a[i]===b[i])out.push("  "+(a[i]||""));else{if(a[i]!==undefined)out.push("- "+a[i]);if(b[i]!==undefined)out.push("+ "+b[i])}}
    const el=$("#diffOutput");el.textContent=out.join("\n");el.hidden=false;
  }
  const shortAddress=address=>address?`${address.slice(0,10)}…${address.slice(-6)}`:"UNCONNECTED AUTHOR";
  const statusLabel=status=>({open:"OPEN",incorporated:"INCORPORATED",not_incorporated:"NOT INCORPORATED"}[status]||"OPEN");
  function renderComments(){
    const d=active(),list=$("#commentList"),filter=$("#commentFilter").value;list.replaceChildren();
    const comments=(d?.comments||[]).map(comment=>({...comment,parentId:comment.parentId||null,status:comment.status||"open",section:comment.section||"general"})),roots=comments.filter(comment=>!comment.parentId),open=roots.filter(comment=>comment.status==="open").length;
    $("#openThreadCount").textContent=`${open} OPEN`;const visible=roots.filter(comment=>filter==="all"||comment.status===filter);
    visible.forEach(root=>{
      const thread=document.createElement("article");thread.className=`thread thread-${root.status}`;
      thread.innerHTML=`<div class="thread-top"><span class="thread-status">${statusLabel(root.status)}</span><small>${esc(root.section.toUpperCase().replace(":"," "))} · VERSION ${root.version}</small></div><p>${esc(root.body)}</p><small>${esc(shortAddress(root.author))} · ${new Date(root.createdAt).toLocaleString()}</small>`;
      const replies=document.createElement("div");replies.className="thread-replies";comments.filter(comment=>comment.parentId===root.id).forEach(reply=>{const node=document.createElement("div");node.className="reply";node.innerHTML=`<p>${esc(reply.body)}</p><small>${esc(shortAddress(reply.author))} · ${new Date(reply.createdAt).toLocaleString()}</small>`;replies.append(node)});thread.append(replies);
      if(root.status!=="open"&&root.decisionReason){const decision=document.createElement("div");decision.className="decision-note";decision.innerHTML=`<b>AUTHOR DECISION</b><p>${esc(root.decisionReason)}</p><small>${root.decisionVersion?`VERSION ${root.decisionVersion}`:"CURRENT VERSION"}</small>`;thread.append(decision)}
      if(state.member){const replyForm=document.createElement("form");replyForm.className="reply-form";replyForm.innerHTML='<textarea maxlength="1500" placeholder="Reply to this thread"></textarea><button type="submit">REPLY</button>';replyForm.onsubmit=event=>{event.preventDefault();const body=replyForm.querySelector("textarea").value.trim();if(!body)return;d.comments.push({id:uid(),parentId:root.id,body,author:state.address,version:d.versions.length,createdAt:new Date().toISOString()});persist();renderComments()};thread.append(replyForm)}
      if(canAuthor(d)){const controls=document.createElement("div");controls.className="decision-controls";controls.innerHTML=`<select aria-label="Thread decision"><option value="open">OPEN</option><option value="incorporated">INCORPORATED</option><option value="not_incorporated">NOT INCORPORATED</option></select><input maxlength="500" placeholder="Explain the author's decision" value="${esc(root.decisionReason||"")}"><button type="button">SAVE DECISION</button>`;controls.querySelector("select").value=root.status;controls.querySelector("button").onclick=()=>{const status=controls.querySelector("select").value,reason=controls.querySelector("input").value.trim();if(status!=="open"&&!reason){alert("Explain why this feedback was or was not incorporated.");return}const original=d.comments.find(comment=>comment.id===root.id);Object.assign(original,{status,decisionReason:status==="open"?"":reason,decisionVersion:status==="open"?null:d.versions.length,decidedAt:new Date().toISOString()});persist();renderComments()};thread.append(controls)}
      list.append(thread);
    });
    if(!visible.length)list.innerHTML='<p class="empty">No discussions match this filter.</p>';
    const enabled=Boolean(state.member&&d?.status==="published");$("#commentBody").disabled=$("#commentSection").disabled=$("#commentForm button").disabled=!enabled;
  }
  function renderDaoPicker(){
    const select=$("#daoSelect");select.innerHTML=DAOS.map(dao=>`<option value="${esc(dao.id)}">${esc(dao.name)} · REVIEWED</option>`).join("");select.value=state.daoId;
  }
  async function selectDao(id){
    if(!DAOS.some(dao=>dao.id===id))return;state.daoId=id;state.active=state.drafts.find(d=>d.daoId===id)?.id||null;state.ownerAccess=OWNER_TESTERS.includes(state.address);state.member=state.ownerAccess;state.votingPower="0";persist();renderDaoPicker();renderDrafts();fillForm(active());renderMembership();
    if(state.address)try{const result=await smart(selectedDao().core,{voting_power_at_height:{address:state.address,height:null}});state.votingPower=String(result.power||"0");state.member=state.ownerAccess||BigInt(state.votingPower)>0n;renderMembership();renderComments()}catch(e){if(state.ownerAccess){renderMembership();renderComments()}else renderMembership(e.message)}
  }
  function closeWalletMenu(){$("#walletMenu").hidden=true;$("#walletButton").setAttribute("aria-expanded","false")}
  function disconnect(){state.address=null;state.member=false;state.ownerAccess=false;state.votingPower="0";closeWalletMenu();renderMembership();renderComments()}
  $("#walletButton").onclick=()=>{if(!state.address){connect().then(renderComments).catch(e=>renderMembership(e.message));return}const menu=$("#walletMenu"),open=menu.hidden;menu.hidden=!open;$("#walletButton").setAttribute("aria-expanded",String(open))};
  $("#copyAddress").onclick=()=>state.address&&navigator.clipboard.writeText(state.address);
  $("#disconnectWallet").onclick=disconnect;
  $("#newDraft").onclick=()=>{state.active=null;state.editing=false;renderDrafts();fillForm(null)};
  $("#addAction").onclick=()=>addAction();
  $("#saveRevision").onclick=saveRevision;$("#publishDraft").onclick=publishDraft;$("#editRevision").onclick=editRevision;$("#freezeDraft").onclick=freeze;$("#exportDraft").onclick=exportDraft;$("#compareVersions").onclick=compare;
  $("#toggleCode").onclick=()=>{$("#codeOutput").hidden=!$("#codeOutput").hidden;renderCode()};
  $("#commentForm").onsubmit=e=>{e.preventDefault();const d=active(),body=$("#commentBody").value.trim();if(!state.member||d?.status!=="published"||!body)return;d.comments.push({id:uid(),parentId:null,body,author:state.address,version:d.versions.length,section:$("#commentSection").value,status:"open",decisionReason:"",createdAt:new Date().toISOString()});$("#commentBody").value="";persist();renderComments()};
  $("#commentFilter").onchange=renderComments;
  $("#daoSelect").onchange=e=>selectDao(e.target.value);
  document.addEventListener("click",e=>{if(!e.target.closest(".wallet-area"))closeWalletMenu()});document.addEventListener("keydown",e=>{if(e.key==="Escape")closeWalletMenu()});
  restore();renderDaoPicker();renderMembership();renderDrafts();fillForm(active());
})();
