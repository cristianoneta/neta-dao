import {structureFor} from './dao-hierarchy.mjs?v=20261006-structure-1';
const root = document.querySelector('#dao-structure-panel');
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
function render(scope) {
  if (!root || !scope) return;
  const focusId = root.contains(document.activeElement) ? document.activeElement.dataset.structureId : null;
  root.replaceChildren();
  let structure;
  try { structure = structureFor(scope.organization, window.NetaDaoDirectory); }
  catch (error) { root.append(node('p', 'structure-unavailable', `DAO structure unavailable: ${error.message}`)); return; }
  if (!structure.units.length) { root.append(node('p', 'structure-unavailable', 'No organizational units are configured yet.')); return; }
  const frame = node('section', 'structure-frame');
  frame.classList.toggle('structure-consolidated', scope.consolidated);
  frame.setAttribute('aria-label', `${scope.organization.name} consolidated scope`);
  const header = node('div', 'structure-header'), identity = node('div', 'structure-identity');
  identity.append(node('strong', null, scope.organization.name), node('span', null, `CONSOLIDATED SCOPE · ${structure.units.length} ${structure.units.length === 1 ? 'UNIT' : 'UNITS'}`));
  const overview = node('button', 'structure-overview', 'Consolidated overview ↗');
  overview.type = 'button'; overview.dataset.structureId = 'all';
  overview.setAttribute('aria-pressed', String(scope.consolidated));
  overview.onclick = () => window.dispatchEvent(new CustomEvent('neta:select-dao', {detail: {id: scope.organization.mainDaoId, consolidated: true}}));
  header.append(identity, overview); frame.append(header);
  function branch(items, nested = false) {
    const list = node('ul', nested ? 'structure-branches' : 'structure-tree');
    list.classList.toggle('structure-peers', items.length > 1);
    for (const item of items) {
      const {dao, children} = item, main = dao.id === scope.organization.mainDaoId;
      const li = node('li', 'structure-branch'), button = node('button', 'structure-node');
      const selected = !scope.consolidated && scope.dao.id === dao.id;
      button.type = 'button'; button.dataset.structureId = dao.id;
      button.setAttribute('aria-pressed', String(selected));
      const label = main ? dao.unitName === 'Main' ? dao.name : dao.unitName : dao.unitName || dao.name;
      button.setAttribute('aria-label', `${label}, ${main ? 'main DAO' : 'DAO unit'}${selected ? ', selected' : ''}`);
      if (main) {
        const art = node('img', 'structure-plaza');
        art.src = 'assets/design/assembly-plaza.webp'; art.alt = ''; art.width = 96; art.height = 96; art.decoding = 'async';
        button.append(art);
      } else {
        const art = node('span', 'module-art module-art--contributors structure-art');
        art.setAttribute('aria-hidden', 'true'); button.append(art);
      }
      const copy = node('span', 'structure-node-copy');
      copy.append(node('small', null, main ? 'MAIN' : dao.parentDaoId ? 'SUBDAO' : 'DAO UNIT'), node('strong', null, label), node('span', 'structure-selected', selected ? '● Selected' : '\u00a0'));
      button.append(copy);
      button.onclick = () => window.dispatchEvent(new CustomEvent('neta:select-dao', {detail: {id: dao.id}}));
      li.append(button); if (children.length) li.append(branch(children, true)); list.append(li);
    }
    return list;
  }
  frame.append(branch(structure.roots));
  const footer = node('div', 'structure-footer'), legend = node('span', 'structure-legend');
  const dot = node('i'); dot.setAttribute('aria-hidden', 'true');
  legend.append(dot, document.createTextNode(scope.consolidated ? 'Consolidated scope selected' : 'Current selection'));
  footer.append(legend, node('span', null, 'Organizational structure · not contract authority')); frame.append(footer);
  const detail = node('div', 'structure-detail'); detail.setAttribute('role', 'status');
  detail.append(node('span', null, 'Selected scope'), node('strong', null, scope.consolidated ? `${scope.organization.name} · Consolidated overview` : scope.dao.unitName === 'Main' ? scope.dao.name : scope.dao.unitName), node('span', null, scope.consolidated ? 'Includes all units inside the frame.' : scope.dao.relationshipNote || `Main reporting unit of ${scope.organization.name}.`));
  root.append(frame, detail);
  if (focusId) [...root.querySelectorAll('[data-structure-id]')].find(el => el.dataset.structureId === focusId)?.focus({preventScroll: true});
}
window.addEventListener('neta:dao-change', event => render(event.detail.scope));
render(window.NETA_DAO_SCOPE);
