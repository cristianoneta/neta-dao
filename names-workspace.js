(() => {
  "use strict";
  // Directory and local follows; UNI-7 wallet actions live in names-v2-workspace.mjs.
  const root = document.querySelector("#names-view");
  if (!root) return;
  const find = selector => root.querySelector(selector);
  const panels = [...root.querySelectorAll("[data-name-panel]")];
  const status = find("#names-ui-status");
  const query = find("#names-directory-query");
  const directory = window.NetaDaoDirectory.map(dao=>({...dao,title:dao.profileName||dao.name,name:dao.directoryName,address:dao.core||""}));
  let activeDao=directory[0];

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function announce(message) { status.textContent = message; status.hidden = false; }
  function show(name, focus = true) {
    if (!panels.some(panel => panel.dataset.namePanel === name)) return;
    panels.forEach(panel => { panel.hidden = panel.dataset.namePanel !== name; });
    const copy = {
      directory:["Directory","Find a DAO and choose the updates you want to receive."],
      contacts:["Contacts","Keep the people and DAOs you use most in one place."],
      profile:["My profile","Your name, public contacts and validator identities."],
      register:["Your .neta name","Register, renew and transfer your .neta name on the selected network."],
      dao:["DAO profile","Identity, address and updates for this DAO."]
    }[name];
    find("#names-page-title").textContent = copy[0];
    find("#names-page-description").textContent = copy[1];
    status.hidden = true;
    if (focus) {
      const heading = find("#names-page-title");
      if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
    }
  }
  function navigate(panel,dao) { window.dispatchEvent(new CustomEvent("neta:navigate-relay", {detail:{panel,dao}})); }
  window.addEventListener("neta:relay-panel", event => {if(event.detail.panel==="dao")renderDao(event.detail.dao);show(event.detail.panel, event.detail.focus)});
  root.addEventListener("click", event => {
    const button = event.target.closest("button[data-name-view]");
    if (button && !button.disabled) navigate(button.dataset.nameView);
  });
  const list = find("#names-directory-list");
  for (const entry of directory) {
    const row = element("article", "names-directory-row");
    row.dataset.directoryId = entry.id;
    const avatar = element("span", "names-avatar", entry.title[0]);
    avatar.setAttribute("aria-hidden", "true");
    const identity = element("div", "names-directory-identity");
    identity.append(element("h3", null, entry.title), element("p", "names-help", entry.id === "juno" ? "Juno · Network governance" : "Juno · DAO"));
    const actions = element("div", "names-directory-actions");
    const follow = element("button"); follow.type = "button";
    follow.dataset.relayDao = entry.id;
    follow.setAttribute("aria-label", `Follow ${entry.title}`);
    follow.setAttribute("aria-pressed", "false");
    const star = element("i", null, "☆"); star.setAttribute("aria-hidden", "true");
    const label = element("span", null, "Follow"); label.dataset.followLabel = "";
    follow.append(star, label); actions.append(follow);
    {
      const button = element("button", null, "View profile"); button.type = "button";
      button.setAttribute("aria-label", `View ${entry.title}`);
      button.addEventListener("click", () => navigate("dao",entry.id)); actions.append(button);
    }
    row.append(avatar, identity, actions); list.append(row);
  }
  const empty = element("div", "names-empty");
  empty.append(element("h3", null, "No matching directory entry"), element("p", null, "Try another search or show all entries. Search results do not indicate name availability."));
  const calculate = element("button", null, "Calculate name fee"); calculate.type = "button";
  calculate.addEventListener("click", () => { find("#names-fee-label").value = query.value.trim(); updateFee(); navigate("register"); });
  empty.append(calculate); list.append(empty);
  function renderDirectory() {
    const term = query.value.trim().toLowerCase();
    let count = 0;
    directory.forEach(entry => {
      const row = list.querySelector(`[data-directory-id="${entry.id}"]`);
      const followed = row.querySelector("[data-relay-dao]").getAttribute("aria-pressed") === "true";
      const matches = `${entry.title} ${entry.name} ${entry.address}`.toLowerCase().includes(term);
      row.hidden = !matches || (find("#names-directory-filter").value === "followed" && !followed);
      if (!row.hidden) count++;
    });
    empty.hidden = count > 0;
    find("#names-directory-count").textContent = `${count} of ${directory.length} directory entries`;
  }
  query.addEventListener("input", renderDirectory);
  find("#names-directory-filter").addEventListener("change", renderDirectory);
  window.addEventListener("neta:following-change", renderDirectory);
  const reserved = new Set(["dao", "admin", "neta", "relay", "support", "treasury", "governance"]);
  function updateFee() {
    const input = find("#names-fee-label"), label = input.value.trim().toLowerCase().replace(/\.neta$/, "");
    const years = Number(find("#names-fee-years").value);
    const valid = /^(?=.{3,32}$)[a-z0-9]+(?:-[a-z0-9]+)*$/.test(label) && !reserved.has(label);
    // Keep the fixed .neta suffix outside the editable label, including pasted names.
    if (valid && /\.neta$/i.test(input.value.trim())) input.value = label;
    const annual = label.length === 3 ? 99 : label.length === 4 ? 19 : 5;
    input.setAttribute("aria-invalid", String(Boolean(label) && !valid));
    find("#names-fee-error").textContent = !label || valid ? "" : "Use 3–32 letters, numbers or interior hyphens. System names are reserved.";
    find("#names-fee-total").textContent = valid ? `$${annual * years} USD` : "Choose a valid name";
    find("#names-fee-annual").textContent = valid ? `$${annual} per year · ${years} year${years === 1 ? "" : "s"} · paid in NETA` : "";
  }
  find("#names-fee-form").addEventListener("submit", event => { event.preventDefault(); updateFee(); });
  find("#names-fee-label").addEventListener("input", updateFee);
  find("#names-fee-years").addEventListener("change", updateFee);
  function workspace(dao,view) {
    window.dispatchEvent(new CustomEvent("neta:select-dao",{detail:{id:dao.id}}));
    document.querySelector(`button[data-workspace-view="${view}"]`).click();
  }
  function renderDao(id) {
    activeDao=directory.find(dao=>dao.id===id);
    const dao=activeDao,host=find("#names-dao-profile");host.replaceChildren();
    if(!dao){host.append(element("h2",null,"Unknown DAO"),element("p","names-help","This DAO is not in the verified directory. Return to the directory to choose an available profile."));return;}
    const layout=element("div","names-layout"),profile=element("article","names-panel"),address=element("aside","names-panel");
    profile.append(element("span","names-badge",dao.mode==="native-gov"?"Network governance":"DAO · directory entry"),element("h2",null,dao.title),element("p","names-identity",dao.directoryName),element("p","names-help","Directory name · not registered on-chain · name-based payments unavailable"),element("p",null,dao.description));
    const follow=element("button");follow.type="button";follow.dataset.relayDao=dao.id;follow.setAttribute("aria-pressed","false");follow.setAttribute("aria-label",`Follow ${dao.title}`);const star=element("i",null,"☆");star.setAttribute("aria-hidden","true");const label=element("span",null,"Follow");label.dataset.followLabel="";follow.append(star,label);profile.append(follow);
    const details=element("details","names-info");details.append(element("summary",null,"About this identity"),element("p",null,dao.mode==="native-gov"?"This directory label identifies Juno's native governance module on juno-1. It is not a DAO contract or a normal receiving address. Future registry binding requires a native-governance authorization adapter.":"The directory name is bound here to the Juno DAO core. Its label is derived from the DAO name by removing one trailing DAO. Directory publication does not mean the DAO has approved this profile."),element("p",null,"On-chain DAO names and profile changes remain unavailable until the registry and governance adapters are verified."));profile.append(details);
    profile.append(element("h3",null,"Who can participate?"),element("p",null,dao.membership));
    const actions=element("div","names-actions");for(const [text,view] of [["View proposals","governance"],["View treasury","treasury"],["View participation","people"]]){const b=element("button",null,text);b.type="button";b.onclick=()=>workspace(dao,view);actions.append(b)}profile.append(actions);
    const edit=element("button",null,"Propose a profile change");edit.type="button";edit.disabled=true;edit.setAttribute("aria-describedby","names-dao-edit-help");const help=element("p","names-help","Profile governance becomes available with the DAO profile registry.");help.id="names-dao-edit-help";profile.append(edit,help);
    address.append(element("h3",null,dao.core?"DAO address":"Community Pool"),element("p","names-help","Juno · juno-1"));
    const full=element("p","names-address",dao.core||"Native distribution module · no ordinary receiving address");full.id="names-dao-address";address.append(full);
    if(dao.core){const copy=element("button",null,"Copy address");copy.type="button";copy.id="names-copy-address";copy.onclick=async()=>{try{await navigator.clipboard.writeText(dao.core);announce("Juno DAO address copied.")}catch{announce("Select and copy the full address above.")}};address.append(copy,element("p","names-help","Verify this core address and network before sending funds."));}
    else address.append(element("p",null,"Community Pool funding requires the supported chain transaction. Do not send tokens to the directory name."));
    for(const label of ["Send NETA","Save contact"]){const b=element("button",null,label);b.type="button";b.disabled=true;address.append(b)}
    address.append(element("p","names-help","Name-based payments and wallet-linked contacts are not available yet."));layout.append(profile,address);host.append(layout);
    if(dao.membershipSource){const members=element("section","names-panel");host.append(members);window.NetaDaoMembers.mount(members,dao);}
    window.dispatchEvent(new Event("neta:directory-profile"));
  }
  renderDirectory(); if(document.body.dataset.relayPanel==="dao")renderDao(location.hash.split("/")[2]); show(document.body.dataset.relayPanel || "directory", false);
})();

