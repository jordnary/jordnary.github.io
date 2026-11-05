type PageConnection = EventTarget & { saveData?: boolean; effectiveType?: string; downlink?: number; rtt?: number }

export function pageConnection() {
  return (navigator as Navigator & { connection?: PageConnection }).connection
}

/** Missing estimates permit one code target; only a known fast link permits image warming. */
export function pageNetworkPolicy() {
  const connection = pageConnection()
  const code = navigator.onLine && !connection?.saveData
    && (!connection?.effectiveType || connection.effectiveType === '4g')
    && (!connection?.downlink || connection.downlink > 2)
    && (!connection?.rtt || connection.rtt < 150)
  return { code, images: code && connection?.effectiveType === '4g' && (connection.downlink ?? 0) > 2 }
}
