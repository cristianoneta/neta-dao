(()=>{
  const buttons=[...document.querySelectorAll("[data-workspace-view]")];
  const views={home:document.querySelector("#home-view"),governance:document.querySelector("#governance-view"),delivery:document.querySelector("#delivery-view"),contributors:document.querySelector("#contributors-view"),treasury:document.querySelector("#treasury-view")};
  buttons.forEach(button=>button.addEventListener("click",()=>{
    const selected=button.dataset.workspaceView;
    buttons.forEach(item=>item.classList.toggle("active",item===button));
    Object.entries(views).forEach(([name,view])=>view.hidden=name!==selected);
    document.body.dataset.workspaceView=selected;
    window.scrollTo({top:0,behavior:"smooth"});
  }));
  document.querySelectorAll("[data-home-target]").forEach(button=>button.addEventListener("click",()=>{const tab=buttons.find(item=>item.dataset.workspaceView===button.dataset.homeTarget);if(tab)tab.click()}));
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
})();
