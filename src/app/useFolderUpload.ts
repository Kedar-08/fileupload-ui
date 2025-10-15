'use client';

import { useMemo, useRef, useState } from 'react';

export type ApiState = 'idle' | 'loading' | 'success' | 'error';
export type JsonValue = unknown;

// Env-driven config (real backend ready)
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
const PROCESS_PATH = process.env.NEXT_PUBLIC_PROCESS_PATH ?? '/process';
const API_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? 60000);

export function useFolderUpload() {
  const dirInputRef = useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [displayPath, setDisplayPath] = useState<string>('');
  const [apiState, setApiState] = useState<ApiState>('idle');
  const [responseJson, setResponseJson] = useState<JsonValue | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [httpStatus, setHttpStatus] = useState<string>('');

  const fileStats = useMemo(() => {
    const count = files.length;
    const totalBytes = files.reduce((n, f) => n + f.size, 0);
    return { count, totalBytes };
  }, [files]);

  function onChooseFolder() {
    dirInputRef.current?.click();
  }

  function handleFolderSelection(list: FileList | null) {
    if (!list || list.length === 0) return;
    const arr = Array.from(list);

    // Label from first file’s relative path
    const rel = (arr[0] as any).webkitRelativePath as string | undefined;
    const label = rel && rel.includes('/') ? rel.split('/')[0] + '/' : 'selected-folder/';

    setFiles(arr);
    setDisplayPath(label);
    setApiState('idle');
    setResponseJson(null);
    setErrorMsg('');
    setHttpStatus('');
  }

  function resetAll() {
    setFiles([]);
    setDisplayPath('');
    setApiState('idle');
    setResponseJson(null);
    setErrorMsg('');
    setHttpStatus('');
    if (dirInputRef.current) dirInputRef.current.value = '';
  }

  async function onRun() {
    if (files.length === 0) {
      setErrorMsg('Please select a folder first.');
      setApiState('error');
      return;
    }

    setApiState('loading');
    setErrorMsg('');
    setResponseJson(null);
    setHttpStatus('');

    try {
      const form = new FormData();
      for (const f of files) {
        const rel = (f as any).webkitRelativePath as string | undefined;
        form.append('files', f, rel || f.name); // include relative paths
      }

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const res = await fetch(`${API_BASE}${PROCESS_PATH}`, {
        method: 'POST',
        body: form,
        signal: controller.signal,
      }).finally(() => clearTimeout(t));

      setHttpStatus(`${res.status} ${res.statusText}`);

      const ct = res.headers.get('content-type') || '';
      const isJson = ct.includes('application/json');

      if (!res.ok) {
        const body = isJson ? await res.json().catch(() => ({})) : await res.text();
        setApiState('error');
        setErrorMsg(typeof body === 'string' ? body : JSON.stringify(body, null, 2));
        return;
      }

      const data = isJson ? await res.json() : await res.text();
      setResponseJson(data);
      setApiState('success');
    } catch (err: any) {
      setApiState('error');
      setErrorMsg(err?.name === 'AbortError' ? 'Request timed out' : (err?.message || 'Network error'));
    }
  }

  async function copyJson() {
    if (!responseJson) return;
    const text = typeof responseJson === 'string' ? responseJson : JSON.stringify(responseJson, null, 2);
    await navigator.clipboard.writeText(text);
  }

  return {
    // refs
    dirInputRef,
    // state
    files, displayPath, apiState, responseJson, errorMsg, httpStatus, fileStats,
    // actions
    onChooseFolder, handleFolderSelection, resetAll, onRun, copyJson,
  };
}

// small helpers if you want them in the UI
export function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${u[i]}`;
}
