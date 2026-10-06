// Organizational reporting scope; never grants on-chain authority.
export function unitsFor(organization, directory) {
  return directory.filter(d => d.organizationId === organization.id).sort((a, b) =>
    (a.id === organization.mainDaoId ? -1 : b.id === organization.mainDaoId ? 1 : a.unitName.localeCompare(b.unitName, 'en', {sensitivity:'base'})));
}
export function resolveSelection(params, organizations, directory, saved = null) {
  const requested = params.get('dao');
  const legacy = directory.find(d => d.id === requested && !organizations.some(o => o.id === requested));
  const organization = organizations.find(o => o.id === (legacy?.organizationId || requested || saved?.organizationId)) || organizations[0];
  const units = unitsFor(organization, directory);
  const subdao = legacy?.id || params.get('subdao') || (!requested ? saved?.unitId : null);
  const unit = units.find(d => d.id === (subdao === 'main' ? organization.mainDaoId : subdao));
  return {organization, units, dao:unit || units.find(d => d.id === organization.mainDaoId), consolidated:!unit};
}
export function selectionParams(selection, params = new URLSearchParams()) {
  params.set('chain', selection.organization.chainId);
  params.set('dao', selection.organization.id);
  if (selection.consolidated) params.delete('subdao');
  else params.set('subdao', selection.dao.id === selection.organization.mainDaoId ? 'main' : selection.dao.id);
  return params;
}

// Read only explicit organizational links; never infer contract control.
export function structureFor(organization, directory) {
  const units = unitsFor(organization, directory);
  const nodes = new Map(units.map(dao => [dao.id, {dao, children: []}]));
  if (nodes.size !== units.length) throw new Error('Duplicate DAO identities in organizational structure.');
  for (const dao of units) {
    const visited = new Set([dao.id]);
    let parent = dao.parentDaoId;
    while (parent) {
      if (!nodes.has(parent)) throw new Error('A parent DAO is outside the configured organization.');
      if (visited.has(parent)) throw new Error('Circular DAO relationship in organizational structure.');
      visited.add(parent);
      parent = nodes.get(parent).dao.parentDaoId;
    }
  }
  const roots = [];
  for (const dao of units) {
    const node = nodes.get(dao.id);
    if (dao.parentDaoId) nodes.get(dao.parentDaoId).children.push(node);
    else roots.push(node);
  }
  return {units, roots};
}
