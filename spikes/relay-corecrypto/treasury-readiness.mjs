// A DAO name also appears in REFRESHING status. Wait for the selected scope's
// completed load; Treasury events and P&L render synchronously before it finishes.
export function waitForTreasury(page, daoId, consolidated = false) {
  return page.waitForFunction(
    ({ daoId, consolidated }) => {
      const accounting = window.NetaTreasuryAccounting,
        view = document.querySelector('#treasury-view'),
        refresh = document.querySelector('#treasury-refresh'),
        status = document.querySelector('#treasury-live-status')?.textContent || '';
      return (
        document.body.dataset.workspaceView === 'treasury' &&
        view &&
        !view.hidden &&
        accounting?.dao?.id === daoId &&
        Boolean(accounting.consolidated) === consolidated &&
        !accounting.loading &&
        refresh &&
        !refresh.disabled &&
        (/^(LIVE|PARTIAL) · /.test(status) || status === 'LIVE DATA UNAVAILABLE')
      );
    },
    { daoId, consolidated }
  );
}
