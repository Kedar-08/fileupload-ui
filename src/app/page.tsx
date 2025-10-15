'use client';

import { useFolderUpload, truncate, formatBytes } from './useFolderUpload';

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

  return (
    <div className="fu-wrapper">
      <header className="fu-header">
        <div className="fu-header-inner">
          <h1 className="fu-title">Folder Uploader</h1>
          <p className="fu-subtitle">Send a single folder to the backend and view the JSON response.</p>
        </div>
      </header>

      <main className="fu-main">
        {/* Selection Bar */}
        <section className="fu-card">
          <div className="fu-row">
            <div className="fu-pathbox">
              <div className="flex flex-col w-full">
                <span className={displayPath ? 'fu-pathtext' : 'fu-pathtext-empty'}>
                  {displayPath || 'No folder selected'}
                </span>
                {files.length > 0 && (
                  <span className="fu-pathmeta">
                    {fileStats.count} files • {formatBytes(fileStats.totalBytes)}
                  </span>
                )}
              </div>
            </div>

            <button type="button" onClick={onChooseFolder} className="fu-btn">
              Choose Folder
            </button>

            <button
              type="button"
              onClick={onRun}
              disabled={apiState === 'loading' || files.length === 0}
              className="fu-btn-disabled"
            >
              {apiState === 'loading' ? 'Running…' : 'RUN'}
            </button>

            <button type="button" onClick={resetAll} className="fu-btn">
              Delete
            </button>
          </div>

          {/* Hidden directory input */}
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
            {apiState === 'success' && <span className="fu-pill">✅ Success</span>}
            {apiState === 'error' && (
              <span className="fu-pill">
                ❌ Failed {errorMsg && <span className="ml-2 opacity-70">({truncate(errorMsg, 140)})</span>}
              </span>
            )}
            {apiState === 'idle' && files.length > 0 && <span className="fu-pill">ℹ️ Ready to run</span>}
          </div>
        </section>

        {/* Response Area */}
        <section className="fu-card">
          <div className="fu-response-head">
            <h2 className="text-lg font-semibold">Response</h2>
            <div className="fu-actions">
              <button type="button" onClick={copyJson} disabled={!responseJson} className="fu-btn">
                Copy JSON
              </button>
              <button type="button" onClick={() => (location.href = location.href)} className="fu-btn" title="Reload page">
                Reload
              </button>
            </div>
          </div>

          <pre className="fu-pre">
            {responseJson
              ? typeof responseJson === 'string'
                ? responseJson
                : JSON.stringify(responseJson, null, 2)
              : apiState === 'loading'
                ? 'Waiting for response…'
                : apiState === 'error'
                  ? (errorMsg || 'Request failed.')
                  : 'No response yet.'}
          </pre>
        </section>
      </main>
    </div>
  );
}
