(()=>{
  const buttons=[...document.querySelectorAll("[data-workspace-view]")];
  const views={home:document.querySelector("#home-view"),governance:document.querySelector("#governance-view"),delivery:document.querySelector("#delivery-view"),contributors:document.querySelector("#contributors-view"),treasury:document.querySelector("#treasury-view"),relay:document.querySelector("#relay-view")};
  const VIEW_STORAGE_KEY="neta-workspace-active-view";
  const relayPanels=[...document.querySelectorAll("[data-relay-panel-view]")];
  const relayButtons=[...document.querySelectorAll("[data-relay-panel]")];
  function route(value){
    if(value==="names")return {view:"relay",panel:"names"};
    if(value==="relay"||value==="relay/inbox")return {view:"relay",panel:"inbox"};
    if(value==="relay/following"||value==="relay/names")return {view:"relay",panel:value.split("/")[1]};
    return {view:views[value]?value:"home",panel:"inbox"};
  }
  function selectView(selected,{updateHash=true,scroll=true}={}){
    const {view,panel}=route(selected);
    buttons.forEach(item=>item.classList.toggle("active",item.dataset.workspaceView===view));
    Object.entries(views).forEach(([name,element])=>element.hidden=name!==view);
    relayPanels.forEach(element=>element.hidden=view!=="relay"||element.dataset.relayPanelView!==panel);
    relayButtons.forEach(button=>{
      const active=view==="relay"&&button.dataset.relayPanel===panel;
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",String(active));
    });
    document.body.dataset.workspaceView=view;
    const target=view==="relay"?(panel==="inbox"?"#relay":`#relay/${panel}`):`#${view}`;
    try{localStorage.setItem(VIEW_STORAGE_KEY,target.slice(1))}catch{}
    if(updateHash&&window.location.hash!==target)history.replaceState(null,"",target);
    if(scroll)window.scrollTo({top:0,behavior:"smooth"});
  }
  buttons.forEach(button=>button.addEventListener("click",()=>selectView(button.dataset.workspaceView)));
  relayButtons.forEach(button=>button.addEventListener("click",()=>selectView("relay/"+button.dataset.relayPanel)));
  document.querySelector("#relay-open-names")?.addEventListener("click",()=>selectView("relay/names"));
  document.querySelectorAll("[data-home-target]").forEach(button=>button.addEventListener("click",()=>selectView(button.dataset.homeTarget)));
  window.addEventListener("hashchange",()=>selectView(window.location.hash.slice(1)));
  const scopes={
    "neta-operations":{delivery:"NETA OPERATIONS DAO · DELIVERY",contributors:"NETA OPERATIONS DAO · CONTRIBUTORS",treasury:"NETA OPERATIONS DAO · TREASURY"},
    juno:{delivery:"JUNO NETWORK GOVERNANCE · DELIVERY",contributors:"JUNO NETWORK GOVERNANCE · CONTRIBUTORS",treasury:"JUNO NETWORK GOVERNANCE · TREASURY"}
  };
  function applyDaoScope(id){
    const scope=scopes[id]||scopes["neta-operations"];
    document.body.dataset.selectedDao=id;
    for(const name of ["delivery","contributors","treasury"]){
      const view=views[name],eyebrow=view?.querySelector(".concept-hero .eyebrow");
      if(eyebrow)eyebrow.textContent=scope[name];
      if(!view)continue;
      let empty=view.querySelector(".dao-scope-empty");
      if(!empty){empty=document.createElement("div");empty.className="dao-scope-empty";view.append(empty)}
      const unavailable=id!=="neta-operations"&&name!=="treasury";
      [...view.children].slice(1).forEach(child=>{if(child!==empty)child.hidden=unavailable});
      empty.textContent=`${scope[name]} · NO LIVE ${name.toUpperCase()} DATA CONNECTED YET`;
      empty.hidden=!unavailable;
    }
  }
  window.addEventListener("neta:dao-change",event=>applyDaoScope(event.detail.id));
  applyDaoScope(window.NETA_SELECTED_DAO||"neta-operations");
  let initialView=window.location.hash.slice(1);
  if(!initialView||!(initialView in views)&&!["names","relay/inbox","relay/following","relay/names"].includes(initialView))try{initialView=localStorage.getItem(VIEW_STORAGE_KEY)||"home"}catch{initialView="home"}
  selectView(initialView,{updateHash:true,scroll:false});
})();
