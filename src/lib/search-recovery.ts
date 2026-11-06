// Consume a pending reload from the previous search boundary after a deployment.
const recoveryKey = 'site-search-recovery'
export function searchRecovery(): { query: string } | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(recoveryKey) ?? 'null')
    if (value?.href === location.href && typeof value.query === 'string'
      && Number.isFinite(value.time) && Date.now() - value.time >= 0 && Date.now() - value.time < 60000) return value
  } catch { /* Storage may be unavailable; ordinary search remains available. */ }
}
export function clearSearchRecovery() {
  try { sessionStorage.removeItem(recoveryKey) } catch { /* Optional recovery state. */ }
}
