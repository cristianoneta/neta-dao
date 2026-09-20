(()=>{
  const buttons=[...document.querySelectorAll("[data-workspace-view]")];
  const views={governance:document.querySelector("#governance-view"),delivery:document.querySelector("#delivery-view"),treasury:document.querySelector("#treasury-view")};
  buttons.forEach(button=>button.addEventListener("click",()=>{
    const selected=button.dataset.workspaceView;
    buttons.forEach(item=>item.classList.toggle("active",item===button));
    Object.entries(views).forEach(([name,view])=>view.hidden=name!==selected);
    document.body.dataset.workspaceView=selected;
    window.scrollTo({top:0,behavior:"smooth"});
  }));
})();
