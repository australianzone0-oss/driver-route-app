"use client";

import { useState } from "react";
import type { Job, Stop } from "@/lib/types";
import { SignaturePad } from "./SignaturePad";

/** Shrinks a photo so it fits comfortably in storage. */
async function compress(file: File, max = 900): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.7);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function CompleteSheet({
  job,
  stop,
  onCancel,
  onConfirm,
}: {
  job: Job;
  stop: Stop;
  onCancel: () => void;
  onConfirm: (d: { receivedBy?: string; photo?: string; signature?: string; notify: boolean }) => void;
}) {
  const isDrop = stop.type === "dropoff";
  const [receivedBy, setReceivedBy] = useState("");
  const [photo, setPhoto] = useState<string>();
  const [signature, setSignature] = useState<string>();
  const hasContact = Boolean(job.customerEmail || job.customerPhone);
  const [notify, setNotify] = useState(job.notifyOnComplete && hasContact);
  const contacts = [job.customerEmail, job.customerPhone].filter(Boolean).join(" and ");

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-slate-900/50 sm:items-center" onClick={onCancel}>
      <div
        className="max-h-[92dvh] w-full max-w-md overflow-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
        <h2 className="text-lg font-bold">{isDrop ? "Complete delivery" : "Confirm pickup"}</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {job.customerName} · {stop.address}
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="label">{isDrop ? "Received by" : "Collected from"}</label>
            <input className="field" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Name (optional)" />
          </div>

          <div>
            <label className="label">Photo (optional)</label>
            {photo ? (
              <div className="relative">
                <img src={photo} alt="Proof of delivery" className="h-40 w-full rounded-xl object-cover" />
                <button type="button" className="absolute right-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold" onClick={() => setPhoto(undefined)}>
                  Remove
                </button>
              </div>
            ) : (
              <label className="btn-ghost w-full cursor-pointer">
                📷 Take or choose photo
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setPhoto(await compress(f));
                  }}
                />
              </label>
            )}
          </div>

          {isDrop && (
            <div>
              <label className="label">Signature (optional)</label>
              <SignaturePad onChange={setSignature} />
            </div>
          )}

          {isDrop && (
            <label className={`flex items-start gap-3 rounded-xl p-3 ${hasContact ? "bg-brand-50" : "bg-slate-50"}`}>
              <input type="checkbox" className="mt-1 h-4 w-4" checked={notify} disabled={!hasContact} onChange={(e) => setNotify(e.target.checked)} />
              <span className="text-sm">
                {hasContact ? (
                  <>
                    Notify customer that the job is complete
                    <span className="block text-slate-500">Sends to {contacts}</span>
                  </>
                ) : (
                  <span className="text-slate-500">No email or mobile on this job, so no notice will be sent.</span>
                )}
              </span>
            </label>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-success"
            onClick={() => onConfirm({ receivedBy: receivedBy.trim() || undefined, photo, signature, notify: isDrop && notify })}
          >
            {isDrop ? "Complete job" : "Picked up"}
          </button>
        </div>
      </div>
    </div>
  );
}
