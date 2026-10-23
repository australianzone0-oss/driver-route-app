"use client";

import { useRef, useState } from "react";
import type { ExtractedJob } from "@/app/api/extract/route";
import type { Attachment } from "@/lib/types";

export function DocDrop({ onFields, onAttach }: { onFields: (f: ExtractedJob) => void; onAttach: (a: Attachment) => void }) {
  const [over, setOver] = useState(false);
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "ok" | "warn"; text?: string }>({ kind: "idle" });
  const input = useRef<HTMLInputElement>(null);

  async function handle(file: File) {
    onAttach({ name: file.name, type: file.type, size: file.size });
    setStatus({ kind: "busy", text: `Reading ${file.name}…` });
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/extract", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setStatus({ kind: "warn", text: `${file.name} attached. ${data.error ?? "Couldn't read it."}` });
        return;
      }
      onFields(data.fields);
      setStatus({ kind: "ok", text: `Filled in from ${file.name}. Please check the details below.` });
    } catch {
      setStatus({ kind: "warn", text: `${file.name} attached, but it couldn't be read. Fill in the job by hand.` });
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handle(f);
        }}
        className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-7 text-center transition ${
          over ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
        }`}
      >
        <span className="text-2xl" aria-hidden>
          📄
        </span>
        <span className="mt-2 text-sm font-semibold text-slate-800">Drop a consignment note or PDF here</span>
        <span className="mt-1 text-xs text-slate-500">or tap to choose a file or take a photo</span>
      </button>
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handle(f);
          e.target.value = "";
        }}
      />
      {status.kind !== "idle" && (
        <p
          className={`mt-2 rounded-lg px-3 py-2 text-sm ${
            status.kind === "busy"
              ? "bg-slate-100 text-slate-600"
              : status.kind === "ok"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-amber-50 text-amber-800"
          }`}
        >
          {status.text}
        </p>
      )}
    </div>
  );
}
