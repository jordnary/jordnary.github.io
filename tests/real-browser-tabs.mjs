import { createServer } from 'node:net'

// Use the real default window; isolated Playwright contexts otherwise override
// focus/visibility. Keep the browser's normal background throttling in effect.
export async function launchRealTabs(chromium, channel) {
  const socket = createServer()
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
  const port = socket.address().port
  await new Promise(resolve => socket.close(resolve))
  const browser = await chromium.launch({ channel, headless: false, args: [`--remote-debugging-port=${port}`], ignoreDefaultArgs: [
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  ] })
  try {
    const connection = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { noDefaults: true })
    return { browser, context: connection.contexts()[0], async close() {
      try { await connection.close() } finally { await browser.close() }
    } }
  } catch (error) { await browser.close(); throw error }
}

export async function openSiblingTab(page) {
  const context = page.context()
  const session = await context.newCDPSession(page)
  try {
    const { targetInfo } = await session.send('Target.getTargetInfo')
    const opened = context.waitForEvent('page')
    await session.send('Target.createTarget', { url: 'about:blank', browserContextId: targetInfo.browserContextId, newWindow: false })
    const other = await opened
    await other.bringToFront()
    return other
  } finally { await session.detach() }
}
