/** A classic script can still execute after removal. Once dispatched it belongs to the
 * document until load/error/timeout; scenes own only their cancellable subscriptions. */
export function createCompanionCoreLoader(load: () => Promise<void>, present: () => boolean) {
  type Consumer = { resolve: () => void; reject: (error: unknown) => void }
  let pending: Set<Consumer> | undefined
  return (signal: AbortSignal): Promise<void> => {
    if (signal.aborted) return Promise.reject(signal.reason)
    if (present()) return Promise.resolve()
    const consumers = pending ?? new Set<Consumer>()
    if (!pending) {
      pending = consumers
      queueMicrotask(async () => {
        try {
          if (consumers.size) await load()
          for (const consumer of consumers) consumer.resolve()
        } catch (error) {
          for (const consumer of consumers) consumer.reject(error)
        } finally { pending = undefined }
      })
    }
    return new Promise<void>((resolve, reject) => {
      const remove = () => { consumers.delete(consumer); signal.removeEventListener('abort', cancel) }
      const consumer: Consumer = {
        resolve() { remove(); resolve() },
        reject(error) { remove(); reject(error) },
      }
      const cancel = () => consumer.reject(signal.reason)
      consumers.add(consumer)
      signal.addEventListener('abort', cancel, { once: true })
    })
  }
}
