// Poll only the visible workspace. Cancellation belongs to the caller so its
// response/render guards remain authoritative even if a request ignores abort.
export function createWorkspacePoller({
  view,
  load,
  invalidate,
  intervalMs = 60000,
  window: scope = globalThis.window,
  document = globalThis.document,
  onError = (error) => console.error(error)
}) {
  let active = false,
    suspended = false,
    disposed = false,
    timer = null,
    pending = null;
  const visible = () =>
    !disposed && !suspended && !document.hidden && document.body.dataset.workspaceView === view;
  function clearTimer() {
    if (timer !== null) scope.clearTimeout(timer);
    timer = null;
  }
  function cancel() {
    clearTimer();
    invalidate();
    pending = null;
  }
  function refresh() {
    if (!visible()) return Promise.resolve();
    if (pending) return pending.promise;
    clearTimer();
    const request = {};
    pending = request;
    request.promise = Promise.resolve()
      .then(() => {
        if (pending === request && visible()) return load();
      })
      .catch(onError)
      .finally(() => {
        if (pending !== request) return;
        pending = null;
        if (visible()) timer = scope.setTimeout(refresh, intervalMs);
      });
    return request.promise;
  }
  function sync() {
    const next = visible();
    if (active === next) return;
    active = next;
    if (active) refresh();
    else cancel();
  }
  function changed() {
    cancel();
    refresh();
  }
  function pagehide() {
    suspended = true;
    sync();
  }
  function pageshow() {
    suspended = false;
    sync();
  }
  scope.addEventListener('neta:workspace-view', sync);
  document.addEventListener('visibilitychange', sync);
  scope.addEventListener('pagehide', pagehide);
  scope.addEventListener('pageshow', pageshow);
  sync();
  return {
    refresh,
    changed,
    dispose() {
      disposed = true;
      cancel();
      scope.removeEventListener('neta:workspace-view', sync);
      document.removeEventListener('visibilitychange', sync);
      scope.removeEventListener('pagehide', pagehide);
      scope.removeEventListener('pageshow', pageshow);
    }
  };
}
