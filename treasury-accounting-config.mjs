// The statement renderer is shared. DAO-specific adapters only supply accounts and receipts.
export const expenseAccounts = [
  { id: 'development', label: 'Development & operations', section: 'expenses' },
  { id: 'marketing', label: 'Marketing & community', section: 'expenses' },
  { id: 'grants', label: 'Grants', section: 'expenses' },
  { id: 'network_fees', label: 'Network fees', section: 'expenses' },
  { id: 'other_expenses', label: 'Other expenses', section: 'expenses' },
];
export const accountingProfiles = {
  'juno-delegation': {
    adapter: 'treasury-receipts',
    accounts: [{ id: 'staking_rewards', label: 'Staking rewards', section: 'income' }],
  },
  juno: {
    adapter: 'native-community-pool',
    accounts: [{ id: 'community_tax', label: 'Community Tax', section: 'income' }],
  },
  neta: {
    adapter: 'nns-receipts',
    accounts: [
      { id: 'nns_registration', label: 'NNS registrations', section: 'income', detail: 'nns-transactions.html', filter: 'nns_registration' },
      { id: 'nns_renewal', label: 'NNS renewals', section: 'income', detail: 'nns-transactions.html', filter: 'nns_renewal' },
    ],
  },
};
export function accountsFor(dao, profiles = accountingProfiles) {
  return [...(profiles[dao?.id]?.accounts || []),
    { id: 'other_income', label: 'Other income', section: 'income' }, ...expenseAccounts];
}
