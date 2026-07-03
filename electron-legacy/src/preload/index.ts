import { contextBridge, ipcRenderer } from 'electron'

// A single generic `invoke` bridge keeps the surface small; the renderer wraps
// it in a typed API (src/renderer/src/lib/api.ts).
const api = {
  invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args)
}

contextBridge.exposeInMainWorld('api', api)

export type PreloadApi = typeof api
