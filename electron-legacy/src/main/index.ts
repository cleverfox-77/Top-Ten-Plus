import { app, shell, BrowserWindow, session } from 'electron'
import { join } from 'path'
import { getDb } from './db/database'
import { seedIfEmpty } from './db/seed'
import { registerIpc } from './ipc'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'Top Ten Plus',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  // Renderer self-check (RENDERER_LOG=1): verify React mounts and the preload
  // bridge is present, then exit. Used for headless verification only.
  if (process.env['RENDERER_LOG']) {
    mainWindow.webContents.on('render-process-gone', (_e, d) =>
      console.log('[renderer gone]', d.reason)
    )
    mainWindow.webContents.once('did-finish-load', async () => {
      // give React a beat to mount and run its initial IPC calls
      setTimeout(async () => {
        try {
          const res = await mainWindow.webContents.executeJavaScript(
            `({ rootChildren: document.getElementById('root')?.children.length ?? -1,
                hasApi: typeof window.api === 'object',
                text: (document.body.innerText || '').replace(/\\s+/g,' ').slice(0,140) })`
          )
          console.log('[renderer check]', JSON.stringify(res))
        } catch (e) {
          console.log('[renderer check error]', String(e))
        }
        app.exit(0)
      }, 1500)
    })
  }

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // electron-vite injects the dev-server URL in development and a built file in prod.
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  // Smoke-test mode: use a throwaway data dir so real shop data is untouched.
  if (process.env['SMOKE_TEST']) {
    app.setPath('userData', join(app.getPath('temp'), `ttp-smoke-${Date.now()}`))
  }

  // In production the renderer is fully local & bundled, so lock it down with a
  // strict CSP via headers. In dev we skip it so Vite HMR / React Refresh work.
  if (!process.env['ELECTRON_RENDERER_URL']) {
    session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
      cb({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'"
          ]
        }
      })
    })
  }

  // Initialise DB + seed before any window/IPC touches it.
  getDb()
  seedIfEmpty()
  registerIpc()

  if (process.env['SMOKE_TEST']) {
    const { runSmokeTest } = await import('./smoketest')
    const code = await runSmokeTest()
    app.exit(code)
    return
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
