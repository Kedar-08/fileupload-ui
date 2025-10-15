"use client";

import { useFolderUpload } from "./useFolderUpload";

// local helpers (tiny, avoids importing from the hook)
function truncate(s: string, n: number) {
  if (!s) return s;
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

export default function Page() {
  const {
    dirInputRef,
    files,
    displayPath,
    apiState,
    responseJson,
    errorMsg,
    httpStatus,
    fileStats,
    onChooseFolder,
    handleFolderSelection,
    resetAll,
    onRun,
    copyJson,
  } = useFolderUpload();

  // if Electron selected a folder, files[] will be empty; we still want a nice meta line
  const hasElectronSelection = !!displayPath && files.length === 0;

  return (
    <div className="fu-wrapper">
      <header className="fu-header">
        <div className="fu-header-inner">
          <h1 className="fu-title">Folder Uploader</h1>
          <p className="fu-subtitle">
            Select a folder and run the backend job.
          </p>
        </div>
      </header>

      <main className="fu-main">
        {/* Selection Bar */}
        <section className="fu-card">
          <div className="fu-row">
            {/* Input-like display of selected path */}
            <div className="fu-pathbox">
              <div className="flex flex-col w-full">
                <span
                  className={displayPath ? "fu-pathtext" : "fu-pathtext-empty"}
                >
                  {displayPath || "No folder selected"}
                </span>

                {/* Meta line: show file count/size in browser mode; a simple hint in Electron mode */}
                {files.length > 0 ? (
                  <span className="fu-pathmeta">
                    {fileStats.count} files •{" "}
                    {formatBytes(fileStats.totalBytes)}
                  </span>
                ) : hasElectronSelection ? (
                  <span className="fu-pathmeta">Folder selected</span>
                ) : null}
              </div>
            </div>

            <button type="button" onClick={onChooseFolder} className="fu-btn">
              Choose Folder
            </button>

            <button
              type="button"
              onClick={onRun}
              disabled={
                apiState === "loading" || (!displayPath && files.length === 0)
              }
              className="fu-btn-disabled"
            >
              {apiState === "loading" ? "Running…" : "RUN"}
            </button>

            <button type="button" onClick={resetAll} className="fu-btn">
              Delete
            </button>
          </div>

          {/* Hidden directory input (used only in browser fallback; Electron won’t use this) */}
          <input
            ref={dirInputRef}
            type="file"
            // @ts-expect-error - Chromium/Edge supported
            webkitdirectory="true"
            directory="true"
            className="fu-hidden"
            onChange={(e) => handleFolderSelection(e.target.files)}
          />

          {/* Status */}
          <div className="fu-status">
            {httpStatus && <span className="fu-pill">HTTP {httpStatus}</span>}
            {apiState === "success" && (
              <span className="fu-pill">✅ Success</span>
            )}
            {apiState === "error" && (
              <span className="fu-pill">
                ❌ Failed{" "}
                {errorMsg && (
                  <span className="ml-2 opacity-70">
                    ({truncate(errorMsg, 140)})
                  </span>
                )}
              </span>
            )}
            {apiState === "idle" &&
              (files.length > 0 || hasElectronSelection) && (
                <span className="fu-pill">ℹ️ Ready to run</span>
              )}
          </div>
        </section>

        {/* Response Area */}
        <section className="fu-card">
          <div className="fu-response-head">
            <h2 className="text-lg font-semibold">Response</h2>
            <div className="fu-actions">
              <button
                type="button"
                onClick={copyJson}
                disabled={!responseJson}
                className="fu-btn"
              >
                Copy JSON
              </button>
              <button
                type="button"
                onClick={() => (location.href = location.href)}
                className="fu-btn"
                title="Reload page"
              >
                Reload
              </button>
            </div>
          </div>

          <pre className="fu-pre">
            {responseJson
              ? typeof responseJson === "string"
                ? responseJson
                : JSON.stringify(responseJson, null, 2)
              : apiState === "loading"
              ? "Waiting for response…"
              : apiState === "error"
              ? errorMsg || "Request failed."
              : "No response yet."}
          </pre>
        </section>
      </main>
    </div>
  );
}
