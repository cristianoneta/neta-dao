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
})();
