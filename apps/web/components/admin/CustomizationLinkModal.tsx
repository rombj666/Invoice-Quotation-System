"use client";

import { useEffect, useRef, useState } from "react";

export function CustomizationLinkModal({ url, onClose }: { url: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setMessage("Link copied."); }
    catch { setMessage("Unable to copy the link. Open the link and copy it from your browser."); }
  }
  return <dialog ref={dialog} className="admin-link-modal" aria-labelledby="customization-link-title" onCancel={onClose} onClose={onClose}>
    <h2 id="customization-link-title">Customization Link</h2>
    <div className="admin-record-actions">
      <a href={url} target="_blank" rel="noreferrer">Open Link</a>
      <button type="button" onClick={copy}>Copy Link</button>
      <button type="button" onClick={onClose}>Close</button>
    </div>
    {message ? <p role="status">{message}</p> : null}
  </dialog>;
}
