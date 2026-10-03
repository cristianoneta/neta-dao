(()=>{
  const buttons=[...document.querySelectorAll("[data-workspace-view]")];
  const views={home:document.querySelector("#home-view"),governance:document.querySelector("#governance-view"),delivery:document.querySelector("#delivery-view"),people:document.querySelector("#people-view"),treasury:document.querySelector("#treasury-view"),relay:document.querySelector("#relay-view")};
  const VIEW_STORAGE_KEY="neta-workspace-active-view";
  const relayPanels=[...document.querySelectorAll("[data-relay-panel-view]")];
  const relayButtons=[...document.querySelectorAll("[data-relay-panel]")];
  const namePanels=["directory","contacts","profile","register","dao"];
  function route(value){
    if(value==="contributors")return {view:"people",panel:"members"};
    if(["people","people/members","people/contributors"].includes(value))return {view:"people",panel:value.split("/")[1]||"members"};
    if(["names","relay/names","relay/following"].includes(value))return {view:"relay",panel:"directory"};
    if(value==="relay"||value==="relay/inbox")return {view:"relay",panel:"inbox"};
    if(/^relay\/dao\/[a-z0-9-]+$/.test(value))return {view:"relay",panel:"dao",dao:value.split("/")[2]};
    if(value.startsWith("relay/")&&namePanels.includes(value.slice(6)))return {view:"relay",panel:value.slice(6)};
    return {view:views[value]?value:"home",panel:"inbox"};
  }
  function selectView(selected,{updateHash=true,scroll=true,push=false}={}){
    const {view,panel,dao}=route(selected);
    buttons.forEach(item=>{
      const active=item.dataset.workspaceView===view;
      item.classList.toggle("active",active);
      item.setAttribute("aria-current",active?"page":"false");
    });
    Object.entries(views).forEach(([name,element])=>element.hidden=name!==view);
    relayPanels.forEach(element=>element.hidden=view!=="relay"||element.dataset.relayPanelView!==(namePanels.includes(panel)?"names":panel));
    relayButtons.forEach(button=>{
      const active=view==="relay"&&button.dataset.relayPanel===(panel==="dao"?"directory":panel);
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",String(active));
    });
    document.body.dataset.workspaceView=view;
    document.body.dataset.relayPanel=panel;
    document.querySelectorAll("[data-people-panel-view]").forEach(el=>el.hidden=el.dataset.peoplePanelView!==panel);
    document.querySelectorAll("[data-people-panel]").forEach(el=>{const active=el.dataset.peoplePanel===panel;el.classList.toggle("active",active);el.setAttribute("aria-pressed",String(active))});
    const target=view==="people"?`#people/${panel}`:view==="relay"?(panel==="inbox"?"#relay":`#relay/${panel}${panel==="dao"&&dao?"/"+dao:""}`):`#${view}`;
    try{localStorage.setItem(VIEW_STORAGE_KEY,target.slice(1))}catch{}
    if(updateHash&&window.location.hash!==target){
      if(push)history.pushState(null,"",target);
      else history.replaceState(null,"",target);
    }
    window.dispatchEvent(new CustomEvent("neta:relay-panel",{detail:{panel,dao,focus:scroll&&view==="relay"}}));
    if(scroll)window.scrollTo({top:0,behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
  }
  buttons.forEach(button=>button.addEventListener("click",()=>selectView(button.dataset.workspaceView,{push:true})));
  document.querySelectorAll("[data-people-panel]").forEach(button=>button.addEventListener("click",()=>selectView("people/"+button.dataset.peoplePanel,{push:true})));
  window.addEventListener("neta:navigate-people",event=>selectView("people/"+(event.detail?.panel==="contributors"?"contributors":"members"),{push:true}));
  relayButtons.forEach(button=>button.addEventListener("click",()=>selectView("relay/"+button.dataset.relayPanel,{push:true})));
  document.querySelector("#relay-open-names")?.addEventListener("click",()=>selectView("relay/directory",{push:true}));
  document.querySelectorAll("[data-home-target]").forEach(button=>button.addEventListener("click",()=>selectView(button.dataset.homeTarget)));
  window.addEventListener("neta:navigate-relay",event=>{if(namePanels.includes(event.detail.panel))selectView("relay/"+event.detail.panel+(event.detail.panel==="dao"&&event.detail.dao?"/"+event.detail.dao:""),{push:true});});
  window.addEventListener("hashchange",()=>selectView(window.location.hash.slice(1)));
  const scopes=Object.fromEntries(window.NetaDaoDirectory.map(dao=>[dao.id,Object.fromEntries(["delivery","treasury"].map(view=>[view,dao.name.toUpperCase()+" · "+view.toUpperCase()]))]));
  function applyDaoScope(id){
    const scope=scopes[id]||scopes["neta-operations"];
    document.body.dataset.selectedDao=id;
    document.querySelector("#people-scope").textContent=(window.NetaDaoDirectory.find(d=>d.id===id)?.name||"Unknown DAO").toUpperCase()+" · PEOPLE";
    for(const name of ["delivery","treasury"]){
      const view=views[name],eyebrow=view?.querySelector(".concept-hero .eyebrow");
      if(eyebrow)eyebrow.textContent=scope[name];
      if(!view)continue;
      let empty=view.querySelector(".dao-scope-empty");
      if(!empty){empty=document.createElement("div");empty.className="dao-scope-empty";view.append(empty)}
      const unavailable=id!=="neta-operations"&&name!=="treasury";
      [...view.children].slice(1).forEach(child=>{if(child!==empty&&child.id!=="dao-members-panel"&&child.id!=="treasury-nns")child.hidden=unavailable});
      if(name==="treasury"){
        view.querySelectorAll(".allocation-card,.risk-impact-grid,.cashflow-card,.treasury-bottom-grid").forEach(el=>el.hidden=id!=="neta-operations");
        view.querySelector(".treasury-main-grid").style.gridTemplateColumns=id==="neta-operations"?"":"1fr";
      }
      empty.textContent=`${scope[name]} · NO LIVE ${name.toUpperCase()} DATA CONNECTED YET`;
      empty.hidden=!unavailable;
    }
  }
  window.addEventListener("neta:dao-change",event=>applyDaoScope(event.detail.id));
  applyDaoScope(window.NETA_SELECTED_DAO||"neta-operations");
  let initialView=window.location.hash.slice(1);
  if(!initialView||!/^relay\/dao\/[a-z0-9-]+$/.test(initialView)&&!(initialView in views)&&!["contributors","people/members","people/contributors","names","relay/inbox","relay/following","relay/names",...namePanels.map(panel=>"relay/"+panel)].includes(initialView))try{initialView=localStorage.getItem(VIEW_STORAGE_KEY)||"home"}catch{initialView="home"}
  selectView(initialView,{updateHash:true,scroll:false});
})();


