// electron/main.js
// CommonJS (works out of the box). Requires Electron 25+ (Node 18+).

const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

// ---- Config (env overridable) ----
const DEV_URL = process.env.ELECTRON_START_URL || "http://localhost:3000";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:9000/run";
const MOCK_RUN = process.env.MOCK_RUN === "1";
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 120000);

// ---- window creation ----
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    backgroundColor: "#111111",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on("ready-to-show", () => win.show());
  win.loadURL(DEV_URL);
  return win;
}

// ---- helpers ----
async function postJson(url, jsonBody, timeoutMs = REQUEST_TIMEOUT_MS) {
  // Node 18+ has global fetch & AbortController
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(jsonBody),
      signal: controller.signal,
    });
    const contentType = res.headers.get("content-type") || "";
    const bodyText = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      contentType,
      body: bodyText,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      statusText: e?.name === "AbortError" ? "Timeout" : "Network Error",
      contentType: "text/plain",
      body: String(e?.message || e),
    };
  } finally {
    clearTimeout(t);
  }
}

// ---- app lifecycle & IPC ----
app.whenReady().then(() => {
  // Folder picker -> returns ABSOLUTE path (or null)
  ipcMain.handle("select-folder", async () => {
    const res = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (res.canceled || !res.filePaths?.length) return null;
    return res.filePaths[0];
  });

  // Run job -> either mock or real backend
  ipcMain.handle("run-job", async (_evt, folderpath) => {
    try {
      if (!folderpath || typeof folderpath !== "string") {
        return {
          ok: false,
          status: 400,
          statusText: "Bad Request",
          contentType: "text/plain",
          body: "Missing or invalid folderpath",
        };
      }

      // Validate path exists locally (optional but nice)
      if (!fs.existsSync(folderpath)) {
        return {
          ok: false,
          status: 400,
          statusText: "Bad Request",
          contentType: "text/plain",
          body: `Path does not exist: ${folderpath}`,
        };
      }

      if (MOCK_RUN) {
        // ---- MOCK RESPONSE ----
        await new Promise((r) => setTimeout(r, 250));
        console.log("[MOCK BACKEND] Received folderpath:", folderpath);
        return {
          ok: true,
          status: 200,
          statusText: "OK (mock)",
          contentType: "application/json",
          body: JSON.stringify({
            receivedFolderpath: folderpath,
            isAbsolute: path.isAbsolute(folderpath),
            platform: process.platform,
            ts: new Date().toISOString(),
            note: "This is a local Electron mock. No real network call was made.",
          }),
        };
      }

      // ---- REAL BACKEND CALL ----
      console.log("[PROXY] POST", BACKEND_URL, "body:", { folderpath });
      const result = await postJson(BACKEND_URL, { folderpath });
      return result;
    } catch (err) {
      return {
        ok: false,
        status: 500,
        statusText: "Internal Error",
        contentType: "text/plain",
        body: String(err?.message || err),
      };
    }
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  // Quit on all platforms except macOS (darwin)
  if (process.platform !== "darwin") app.quit();
});
