(() => {
  "use strict";
  // Directory and local follow preferences; registry writes remain inactive.
  const root = document.querySelector("#names-view");
  if (!root) return;
  const find = selector => root.querySelector(selector);
  const panels = [...root.querySelectorAll("[data-name-panel]")];
  const status = find("#names-ui-status");
  const query = find("#names-directory-query");
  const directory = [{id:"neta-operations",title:"NETA Operations DAO",name:"neta-operations.dao.neta",address:find("#names-dao-address").textContent.trim()},{id:"juno",title:"Juno Governance",name:"",address:""}];
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
      profile:["My profile","Your name, introduction and preferred receiving network."],
      register:["Your .neta name","Choose a name and calculate the planned registration fee."],
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
  function navigate(panel) { window.dispatchEvent(new CustomEvent("neta:navigate-relay", {detail:{panel}})); }
  window.addEventListener("neta:relay-panel", event => show(event.detail.panel, event.detail.focus));
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
    if (entry.id === "neta-operations") {
      const button = element("button", null, "View profile"); button.type = "button";
      button.setAttribute("aria-label", `View ${entry.title}`);
      button.addEventListener("click", () => navigate("dao")); actions.append(button);
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
    const annual = label.length === 3 ? 640 : label.length === 4 ? 160 : 5;
    input.setAttribute("aria-invalid", String(Boolean(label) && !valid));
    find("#names-fee-error").textContent = !label || valid ? "" : "Use 3–32 letters, numbers or interior hyphens. System names are reserved.";
    find("#names-fee-total").textContent = valid ? `$${annual * years} USD` : "Choose a valid name";
    find("#names-fee-annual").textContent = valid ? `$${annual} per year · ${years} year${years === 1 ? "" : "s"} · paid in NETA` : "";
  }
  find("#names-fee-form").addEventListener("submit", event => { event.preventDefault(); updateFee(); });
  find("#names-fee-label").addEventListener("input", updateFee);
  find("#names-fee-years").addEventListener("change", updateFee);
  find("#names-copy-address").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(directory[0].address); announce("Juno DAO address copied."); }
    catch { announce("Copy is unavailable in this browser. Select and copy the full address below."); }
  });
  renderDirectory(); show(document.body.dataset.relayPanel || "directory", false);
})();
