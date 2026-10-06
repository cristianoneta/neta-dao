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
