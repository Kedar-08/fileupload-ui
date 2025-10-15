"use client";

import { useMemo, useRef, useState } from "react";

export type ApiState = "idle" | "loading" | "success" | "error";
export type JsonValue = unknown;

// === API config ===
const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:9000"
).replace(/\/+$/, "");
const PROCESS_PATH = process.env.NEXT_PUBLIC_PROCESS_PATH ?? "/run";
const API_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? 60000);

export function useFolderUpload() {
  const dirInputRef = useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [displayPath, setDisplayPath] = useState<string>("");
  const [folderPath, setFolderPath] = useState<string>(""); // ← full relative folder path
  const [apiState, setApiState] = useState<ApiState>("idle");
  const [responseJson, setResponseJson] = useState<JsonValue | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [httpStatus, setHttpStatus] = useState<string>("");

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

    // Collect directory portion of each relative path
    const relDirs = arr
      .map((f) => (f as any).webkitRelativePath as string | undefined)
      .filter(Boolean)
      .map((p) => {
        const s = p as string;
        const idx = s.lastIndexOf("/");
        return idx >= 0 ? s.slice(0, idx) : "";
      });

    // Compute common directory (relative, POSIX style)
    const commonDir = getCommonDir(relDirs); // e.g. "MyFolder" or "MyFolder/subdir"

    // Friendly label (top-level folder name)
    const label = commonDir
      ? commonDir.split("/")[0] + "/"
      : "selected-folder/";

    setFiles(arr);
    setDisplayPath(label);
    setFolderPath(commonDir);
    setApiState("idle");
    setResponseJson(null);
    setErrorMsg("");
    setHttpStatus("");
  }

  function resetAll() {
    setFiles([]);
    setDisplayPath("");
    setFolderPath("");
    setApiState("idle");
    setResponseJson(null);
    setErrorMsg("");
    setHttpStatus("");
    if (dirInputRef.current) dirInputRef.current.value = "";
  }

  async function onRun() {
    if (files.length === 0) {
      setErrorMsg("Please select a folder first.");
      setApiState("error");
      return;
    }

    setApiState("loading");
    setErrorMsg("");
    setResponseJson(null);
    setHttpStatus("");

    try {
      const form = new FormData();

      // Send the folder's full relative path as the backend expects
      if (folderPath) {
        form.append("folderpath", folderPath); // ← key name matches backend convention
      }

      // Send all files with their relative paths so backend can rebuild tree
      for (const f of files) {
        const rel = (f as any).webkitRelativePath as string | undefined;
        form.append("files", f, rel || f.name);
      }

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const res = await fetch(`${API_BASE}${PROCESS_PATH}`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      }).finally(() => clearTimeout(t));

      setHttpStatus(`${res.status} ${res.statusText}`);

      const ct = res.headers.get("content-type") || "";
      const isJson = ct.includes("application/json");

      if (!res.ok) {
        const body = isJson
          ? await res.json().catch(() => ({}))
          : await res.text();
        setApiState("error");
        setErrorMsg(
          typeof body === "string" ? body : JSON.stringify(body, null, 2)
        );
        return;
      }

      const data = isJson ? await res.json() : await res.text();
      setResponseJson(data);
      setApiState("success");
    } catch (err: any) {
      setApiState("error");
      setErrorMsg(
        err?.name === "AbortError"
          ? "Request timed out"
          : err?.message || "Network error"
      );
    }
  }

  async function copyJson() {
    if (!responseJson) return;
    const text =
      typeof responseJson === "string"
        ? responseJson
        : JSON.stringify(responseJson, null, 2);
    await navigator.clipboard.writeText(text);
  }

  return {
    // refs
    dirInputRef,
    // state
    files,
    displayPath,
    apiState,
    responseJson,
    errorMsg,
    httpStatus,
    fileStats,
    // actions
    onChooseFolder,
    handleFolderSelection,
    resetAll,
    onRun,
    copyJson,
  };
}

/** Compute the common directory (POSIX-style, no trailing slash) from a list of relative directories */
function getCommonDir(dirs: string[]): string {
  if (dirs.length === 0) return "";
  const splitDirs = dirs.map((d) => d.split("/").filter(Boolean));
  const first = splitDirs[0];
  const common: string[] = [];

  for (let i = 0; i < first.length; i++) {
    const seg = first[i];
    if (splitDirs.every((parts) => parts[i] === seg)) {
      common.push(seg);
    } else {
      break;
    }
  }
  return common.join("/");
}

// helpers
export function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

export function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${u[i]}`;
}
