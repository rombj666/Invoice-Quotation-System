"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  title: string;
  backHref: string;
  sections: Array<{ id: string; label: string; content: ReactNode }>;
  activeSection: string;
  onSectionChange: (id: string) => void;
  saving: boolean;
  onSave: () => void;
  children?: ReactNode;
};

export function AdminSectionEditor({ title, backHref, sections, activeSection, onSectionChange, saving, onSave, children }: Props) {
  const active = sections.find((section) => section.id === activeSection) ?? sections[0];

  return <div className="admin-section-editor">
    <header className="admin-editor-topbar">
      <Link className="admin-editor-button" href={backHref}><span aria-hidden="true">←</span> Back</Link>
      <div><p className="admin-eyebrow">Document editor</p><h1>{title}</h1></div>
      <Link className="admin-editor-button" href={backHref}>Cancel</Link>
    </header>
    <div aria-live="polite">{children}</div>
    <div className="admin-editor-workspace">
      <nav className="admin-editor-sections" aria-label="Editor sections">
        {sections.map((section, index) => <button
          className={section.id === active.id ? "active" : ""}
          type="button"
          key={section.id}
          id={`editor-section-${section.id}`}
          aria-current={section.id === active.id ? "step" : undefined}
          aria-controls="admin-editor-panel"
          onClick={() => onSectionChange(section.id)}
        ><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{section.label}</button>)}
      </nav>
      <div className="admin-editor-main">
        <div className="admin-editor-panel" id="admin-editor-panel" role="region" aria-labelledby={`editor-section-${active.id}`}>
          {active.content}
        </div>
        <footer className="admin-editor-footer">
          <Link className="admin-editor-button" href={backHref}>Cancel</Link>
          <button className="admin-editor-button primary" type="button" disabled={saving} onClick={onSave}>{saving ? "Saving..." : "Save Changes"}</button>
        </footer>
      </div>
    </div>
  </div>;
}
