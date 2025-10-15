"use client";

import { useMemo, useRef, useState } from "react";

export type ApiState = "idle" | "loading" | "success" | "error";
export type JsonValue = unknown;

const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:9000"
).replace(/\/+$/, "");
const PROCESS_PATH = process.env.NEXT_PUBLIC_PROCESS_PATH ?? "/run";
const API_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? 60000);

// Typesafe window.native from Electron preload (if present)
type NativeRunJobResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  contentType?: string;
  body?: string;
};

declare global {
  interface Window {
    native?: {
      selectFolder: () => Promise<string | null>;
      runJob?: (folderpath: string) => Promise<NativeRunJobResponse>;
    };
  }
}

export function useFolderUpload() {
  const dirInputRef = useRef<HTMLInputElement | null>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [displayPath, setDisplayPath] = useState<string>("");
  const [relFolderPath, setRelFolderPath] = useState<string>(""); // browser fallback
  const [absFolderPath, setAbsFolderPath] = useState<string>(""); // Electron-native result (NOT shown)
  const [apiState, setApiState] = useState<ApiState>("idle");
  const [responseJson, setResponseJson] = useState<JsonValue | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [httpStatus, setHttpStatus] = useState<string>("");

  const fileStats = useMemo(() => {
    const count = files.length;
    const totalBytes = files.reduce((n, f) => n + f.size, 0);
    return { count, totalBytes };
  }, [files]);

  const isElectron = typeof window !== "undefined" && !!window.native;

  async function onChooseFolder() {
    if (isElectron && window.native?.selectFolder) {
      const chosen = await window.native.selectFolder();
      if (!chosen) return;
      // chosen is ABSOLUTE, e.g., D:\Echo\my-app
      setAbsFolderPath(chosen);
      // Show only the last segment in UI for friendliness
      setDisplayPath(chosen.split(/[/\\]/).filter(Boolean).slice(-1)[0] + "/");
      setFiles([]); // not needed in electron mode
      setRelFolderPath(""); // not used in electron mode
      setApiState("idle");
      setResponseJson(null);
      setErrorMsg("");
      setHttpStatus("");
    } else {
      // Browser fallback: open directory file input
      dirInputRef.current?.click();
    }
  }

  function handleFolderSelection(list: FileList | null) {
    if (!list || list.length === 0) return;
    const arr = Array.from(list);

    // Compute full relative folder path from first file
    const rel = (arr[0] as any).webkitRelativePath as string | undefined;
    let commonRel = "";
    if (rel && rel.includes("/"))
      commonRel = rel.slice(0, rel.lastIndexOf("/"));

    setFiles(arr);
    setRelFolderPath(commonRel);
    setDisplayPath((commonRel ? commonRel : "selected-folder") + "/");
    setAbsFolderPath(""); // not known in browser
    setApiState("idle");
    setResponseJson(null);
    setErrorMsg("");
    setHttpStatus("");
  }

  function resetAll() {
    setFiles([]);
    setDisplayPath("");
    setRelFolderPath("");
    setAbsFolderPath("");
    setApiState("idle");
    setResponseJson(null);
    setErrorMsg("");
    setHttpStatus("");
    if (dirInputRef.current) dirInputRef.current.value = "";
  }

  async function onRun() {
    setApiState("loading");
    setErrorMsg("");
    setResponseJson(null);
    setHttpStatus("");

    try {
      let folderToSend = "";

      if (isElectron && absFolderPath && window.native?.runJob) {
        // Electron: use native runJob if available
        const r = await window.native.runJob(absFolderPath);
        setHttpStatus(`${r.status} ${r.statusText}`);

        if (!r.ok) {
          setApiState("error");
          setErrorMsg(r.body || "Request failed");
          return;
        }

        const isJson = (r.contentType || "").includes("application/json");
        const data = isJson ? JSON.parse(r.body || "{}") : r.body;
        setResponseJson(data);
        setApiState("success");
        return;
      }

      if (isElectron && absFolderPath) {
        // ✅ Electron path is absolute
        folderToSend = absFolderPath;
      } else {
        // Browser fallback — cannot provide absolute path
        if (!files.length || !relFolderPath) {
          setApiState("error");
          setErrorMsg(
            "Absolute path not available in browser. Run the Electron desktop app, or change backend to accept relative path / uploads."
          );
          return;
        }
        setApiState("error");
        setErrorMsg(
          "This browser cannot send an absolute path. Use the Electron app to provide D:\\... path."
        );
        return;
      }

      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const res = await fetch(`${API_BASE}${PROCESS_PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ folderpath: folderToSend }), // backend expects absolute here
        signal: controller.signal,
      }).finally(() => clearTimeout(t));

      setHttpStatus(`${res.status} ${res.statusText}`);

      const ct = res.headers.get("content-type") || "";
      const isJson = ct.includes("application/json");

      if (!res.ok) {
        const errBody = isJson
          ? await res.json().catch(() => ({}))
          : await res.text();
        setApiState("error");
        setErrorMsg(
          typeof errBody === "string"
            ? errBody
            : JSON.stringify(errBody, null, 2)
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
