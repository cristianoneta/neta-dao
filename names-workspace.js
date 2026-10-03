(() => {
  "use strict";
  // Read-only UI. Registry signing remains in the inactive names.js module.
  const root = document.querySelector("#names-view");
  if (!root) return;
  const find = selector => root.querySelector(selector);
  const panels = [...root.querySelectorAll("[data-name-panel]")];
  const tabs = [...root.querySelectorAll(".names-tabs [data-name-view]")];
  const status = find("#names-ui-status");
  const query = find("#names-directory-query");
  const directory = [{title:"NETA Operations DAO",name:"neta-operations.dao.neta",address:find("#names-dao-address").textContent.trim()}];
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
    tabs.forEach(tab => tab.setAttribute("aria-pressed", String(tab.dataset.nameView === name)));
    find(".names-tabs").hidden = ["register", "dao"].includes(name);
    find(".names-heading > button").hidden = name !== "directory";
    status.hidden = true;
    if (focus) {
      const heading = panels.find(item => !item.hidden).querySelector("h2");
      if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
      root.scrollIntoView({block:"start", behavior:"instant"});
    }
  }
  root.addEventListener("click", event => {
    const button = event.target.closest("button[data-name-view]");
    if (button && !button.disabled) show(button.dataset.nameView);
  });
  function renderDirectory() {
    const term = query.value.trim().toLowerCase();
    const matches = directory.filter(entry => `${entry.title} ${entry.name} ${entry.address}`.toLowerCase().includes(term));
    const list = find("#names-directory-list");
    list.replaceChildren();
    for (const entry of matches) {
      const row = element("article", "names-directory-row");
      const avatar = element("span", "names-avatar", "N");
      avatar.setAttribute("aria-hidden", "true");
      const identity = element("div", "names-directory-identity");
      identity.append(element("h3", null, entry.title), element("p", "names-help", "Juno · DAO"));
      const button = element("button", null, "View profile");
      button.type = "button"; button.setAttribute("aria-label", `View ${entry.title}`);
      button.addEventListener("click", () => show("dao"));
      row.append(avatar, identity, button); list.append(row);
    }
    if (!matches.length) {
      const empty = element("div", "names-empty");
      empty.append(element("h3", null, "No matching directory entry"), element("p", null, "This does not indicate name availability. You can calculate the planned registration fee."));
      const button = element("button", null, "Calculate name fee"); button.type = "button";
      button.addEventListener("click", () => { find("#names-fee-label").value = query.value.trim(); updateFee(); show("register"); });
      empty.append(button); list.append(empty);
    }
    find("#names-directory-count").textContent = `${matches.length} DAO${matches.length === 1 ? "" : "s"} in the workspace directory`;
  }
  query.addEventListener("input", renderDirectory);
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
  renderDirectory(); show("directory", false);
})();
