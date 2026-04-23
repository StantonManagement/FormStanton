// REFERENCE ONLY — NOT PRODUCTION CODE
//
// This file is a visual design mockup from PBV planning, preserved as a
// reference for Phase 3 of the Foundation Review Layer build. It shows the
// intended visual language for per-document review:
//
//   - Status badges (approved / submitted / rejected / missing / waived)
//   - Progress bar segmented by status
//   - Per-unit expandable cards with document tables
//   - Stats summary row
//   - Filter pills
//
// Adapt these patterns to existing FormStanton component conventions.
// Do NOT import this file, do NOT register as a route, do NOT ship.
// Place at: tasks/reference/pbv-document-tracker.jsx

import { useState } from "react";

const UNITS = [
  {
    assetId: "S0001",
    unit: "1",
    tenant: "Maria Garcia",
    building: "83-91 Park St",
    overallStatus: "in_progress",
  },
  {
    assetId: "S0001",
    unit: "2A",
    tenant: "James Thompson",
    building: "83-91 Park St",
    overallStatus: "complete",
  },
  {
    assetId: "S0024",
    unit: "3N",
    tenant: "Ana Santos",
    building: "144-146 Affleck St",
    overallStatus: "in_progress",
  },
];

const DOCUMENTS = {
  "S0001_1": [
    { docType: "application-signed", label: "Signed Application", status: "approved", fileName: "S0001_1_application-signed_Garcia_20260418_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-19", rejectionReason: null, revision: 1 },
    { docType: "paystubs", label: "Paystubs (Employment 1)", status: "rejected", fileName: "S0001_1_paystubs_Garcia_20260415_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-17", rejectionReason: "Only 2 weekly stubs provided, need 4. Dates are from January — need current.", revision: 1 },
    { docType: "paystubs", label: "Paystubs (Employment 1) — Resubmit", status: "submitted", fileName: "S0001_1_paystubs_Garcia_20260421_v2.pdf", reviewer: null, reviewDate: null, rejectionReason: null, revision: 2 },
    { docType: "ssi-award", label: "SSI Award Letter", status: "approved", fileName: "S0001_1_ssi-award_Garcia_20260415_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-16", rejectionReason: null, revision: 1 },
    { docType: "bankstmt-savings", label: "Bank Statement — Savings", status: "approved", fileName: "S0001_1_bankstmt-savings_Garcia_20260415_v1.pdf", reviewer: "Christine", reviewDate: "2026-04-18", rejectionReason: null, revision: 1 },
    { docType: "bankstmt-checking", label: "Bank Statement — Checking", status: "submitted", fileName: "S0001_1_bankstmt-checking_Garcia_20260420_v1.pdf", reviewer: null, reviewDate: null, rejectionReason: null, revision: 1 },
    { docType: "childsupport-order", label: "Child Support Court Order", status: "missing", fileName: null, reviewer: null, reviewDate: null, rejectionReason: null, revision: 0 },
    { docType: "citizenship-i551", label: "Citizenship — I-551", status: "waived", fileName: null, reviewer: "Tess", reviewDate: "2026-04-16", rejectionReason: "US citizen confirmed", revision: 0 },
    { docType: "criminal-bg-release", label: "Criminal Background Release", status: "approved", fileName: "S0001_1_criminal-bg-release_Garcia_20260418_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-19", rejectionReason: null, revision: 1 },
    { docType: "hud-9886a", label: "HUD-9886-A (Release of Info)", status: "approved", fileName: "S0001_1_hud-9886a_Garcia_20260418_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-19", rejectionReason: null, revision: 1 },
    { docType: "hach-release", label: "HACH Authorization Release", status: "submitted", fileName: "S0001_1_hach-release_Garcia_20260420_v1.pdf", reviewer: null, reviewDate: null, rejectionReason: null, revision: 1 },
    { docType: "obligations-family", label: "Obligations of Family", status: "approved", fileName: "S0001_1_obligations-family_Garcia_20260418_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-19", rejectionReason: null, revision: 1 },
    { docType: "briefing-cert", label: "Briefing Docs Certification", status: "missing", fileName: null, reviewer: null, reviewDate: null, rejectionReason: null, revision: 0 },
    { docType: "citizenship-decl", label: "Citizenship Declaration", status: "approved", fileName: "S0001_1_citizenship-decl_Garcia_20260418_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-19", rejectionReason: null, revision: 1 },
    { docType: "childsupport-affidavit", label: "Child Support Affidavit", status: "missing", fileName: null, reviewer: null, reviewDate: null, rejectionReason: null, revision: 0 },
    { docType: "eiv-receipt", label: "EIV Guide Receipt", status: "approved", fileName: "S0001_1_eiv-receipt_Garcia_20260418_v1.pdf", reviewer: "Christine", reviewDate: "2026-04-19", rejectionReason: null, revision: 1 },
    { docType: "debts-owed-ack", label: "Debts Owed Acknowledgment", status: "submitted", fileName: "S0001_1_debts-owed-ack_Garcia_20260421_v1.pdf", reviewer: null, reviewDate: null, rejectionReason: null, revision: 1 },
    { docType: "hud-92006", label: "HUD-92006 Supplemental Contact", status: "approved", fileName: "S0001_1_hud-92006_Garcia_20260418_v1.pdf", reviewer: "Christine", reviewDate: "2026-04-19", rejectionReason: null, revision: 1 },
  ],
  "S0001_2A": [
    { docType: "application-signed", label: "Signed Application", status: "approved", fileName: "S0001_2A_application-signed_Thompson_20260410_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-11", rejectionReason: null, revision: 1 },
    { docType: "paystubs", label: "Paystubs", status: "approved", fileName: "S0001_2A_paystubs_Thompson_20260410_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-12", rejectionReason: null, revision: 1 },
    { docType: "bankstmt-checking", label: "Bank Statement — Checking", status: "approved", fileName: "S0001_2A_bankstmt-checking_Thompson_20260410_v1.pdf", reviewer: "Christine", reviewDate: "2026-04-12", rejectionReason: null, revision: 1 },
    { docType: "criminal-bg-release", label: "Criminal Background Release", status: "approved", fileName: "S0001_2A_criminal-bg-release_Thompson_20260410_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-11", rejectionReason: null, revision: 1 },
    { docType: "hud-9886a", label: "HUD-9886-A", status: "approved", fileName: "S0001_2A_hud-9886a_Thompson_20260410_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-11", rejectionReason: null, revision: 1 },
    { docType: "hach-release", label: "HACH Authorization Release", status: "approved", fileName: "S0001_2A_hach-release_Thompson_20260410_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-11", rejectionReason: null, revision: 1 },
    { docType: "obligations-family", label: "Obligations of Family", status: "approved", fileName: "S0001_2A_obligations-family_Thompson_20260410_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-11", rejectionReason: null, revision: 1 },
    { docType: "briefing-cert", label: "Briefing Docs Certification", status: "approved", fileName: "S0001_2A_briefing-cert_Thompson_20260410_v1.pdf", reviewer: "Christine", reviewDate: "2026-04-12", rejectionReason: null, revision: 1 },
    { docType: "citizenship-decl", label: "Citizenship Declaration", status: "approved", fileName: "S0001_2A_citizenship-decl_Thompson_20260410_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-11", rejectionReason: null, revision: 1 },
    { docType: "eiv-receipt", label: "EIV Guide Receipt", status: "approved", fileName: "S0001_2A_eiv-receipt_Thompson_20260410_v1.pdf", reviewer: "Christine", reviewDate: "2026-04-12", rejectionReason: null, revision: 1 },
    { docType: "debts-owed-ack", label: "Debts Owed Acknowledgment", status: "approved", fileName: "S0001_2A_debts-owed-ack_Thompson_20260410_v1.pdf", reviewer: "Christine", reviewDate: "2026-04-12", rejectionReason: null, revision: 1 },
    { docType: "hud-92006", label: "HUD-92006 Supplemental Contact", status: "approved", fileName: "S0001_2A_hud-92006_Thompson_20260410_v1.pdf", reviewer: "Christine", reviewDate: "2026-04-12", rejectionReason: null, revision: 1 },
  ],
  "S0024_3N": [
    { docType: "application-signed", label: "Signed Application", status: "approved", fileName: "S0024_3N_application-signed_Santos_20260419_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-20", rejectionReason: null, revision: 1 },
    { docType: "paystubs", label: "Paystubs (Employment 1)", status: "approved", fileName: "S0024_3N_paystubs_Santos_20260419_v1.pdf", reviewer: "Christine", reviewDate: "2026-04-20", rejectionReason: null, revision: 1 },
    { docType: "ss-award", label: "Social Security Award Letter", status: "rejected", fileName: "S0024_3N_ss-award_Santos_20260419_v1.jpg", reviewer: "Tess", reviewDate: "2026-04-20", rejectionReason: "Photo is blurry, can't read amounts. Need clear scan or photo.", revision: 1 },
    { docType: "bankstmt-savings", label: "Bank Statement — Savings", status: "missing", fileName: null, reviewer: null, reviewDate: null, rejectionReason: null, revision: 0 },
    { docType: "bankstmt-checking", label: "Bank Statement — Checking", status: "submitted", fileName: "S0024_3N_bankstmt-checking_Santos_20260421_v1.pdf", reviewer: null, reviewDate: null, rejectionReason: null, revision: 1 },
    { docType: "citizenship-i551", label: "Citizenship — I-551", status: "submitted", fileName: "S0024_3N_citizenship-i551_Santos_20260421_v1.pdf", reviewer: null, reviewDate: null, rejectionReason: null, revision: 1 },
    { docType: "criminal-bg-release", label: "Criminal Background Release", status: "approved", fileName: "S0024_3N_criminal-bg-release_Santos_20260419_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-20", rejectionReason: null, revision: 1 },
    { docType: "hud-9886a", label: "HUD-9886-A", status: "approved", fileName: "S0024_3N_hud-9886a_Santos_20260419_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-20", rejectionReason: null, revision: 1 },
    { docType: "hach-release", label: "HACH Authorization Release", status: "approved", fileName: "S0024_3N_hach-release_Santos_20260419_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-20", rejectionReason: null, revision: 1 },
    { docType: "obligations-family", label: "Obligations of Family", status: "submitted", fileName: "S0024_3N_obligations-family_Santos_20260421_v1.pdf", reviewer: null, reviewDate: null, rejectionReason: null, revision: 1 },
    { docType: "briefing-cert", label: "Briefing Docs Certification", status: "missing", fileName: null, reviewer: null, reviewDate: null, rejectionReason: null, revision: 0 },
    { docType: "citizenship-decl", label: "Citizenship Declaration", status: "approved", fileName: "S0024_3N_citizenship-decl_Santos_20260419_v1.pdf", reviewer: "Tess", reviewDate: "2026-04-20", rejectionReason: null, revision: 1 },
    { docType: "care4kids-cert", label: "Care 4 Kids Certificate", status: "submitted", fileName: "S0024_3N_care4kids-cert_Santos_20260421_v1.pdf", reviewer: null, reviewDate: null, rejectionReason: null, revision: 1 },
    { docType: "eiv-receipt", label: "EIV Guide Receipt", status: "missing", fileName: null, reviewer: null, reviewDate: null, rejectionReason: null, revision: 0 },
    { docType: "debts-owed-ack", label: "Debts Owed Acknowledgment", status: "missing", fileName: null, reviewer: null, reviewDate: null, rejectionReason: null, revision: 0 },
    { docType: "hud-92006", label: "HUD-92006 Supplemental Contact", status: "missing", fileName: null, reviewer: null, reviewDate: null, rejectionReason: null, revision: 0 },
  ],
};

const STATUS_CONFIG = {
  approved: { label: "Approved", bg: "#dcfce7", color: "#166534", dot: "#22c55e" },
  submitted: { label: "Awaiting Review", bg: "#fef9c3", color: "#854d0e", dot: "#eab308" },
  rejected: { label: "Rejected", bg: "#fee2e2", color: "#991b1b", dot: "#ef4444" },
  missing: { label: "Missing", bg: "#f3f4f6", color: "#6b7280", dot: "#d1d5db" },
  waived: { label: "Waived", bg: "#e0e7ff", color: "#3730a3", dot: "#818cf8" },
};

function getStats(docs) {
  const total = docs.filter(d => d.status !== "waived").length;
  const approved = docs.filter(d => d.status === "approved").length;
  const submitted = docs.filter(d => d.status === "submitted").length;
  const rejected = docs.filter(d => d.status === "rejected").length;
  const missing = docs.filter(d => d.status === "missing").length;
  const waived = docs.filter(d => d.status === "waived").length;
  return { total, approved, submitted, rejected, missing, waived };
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 10px", borderRadius: 4, fontSize: 12, fontWeight: 600,
      backgroundColor: cfg.bg, color: cfg.color, whiteSpace: "nowrap",
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function ProgressBar({ stats }) {
  const total = stats.total + stats.waived;
  if (total === 0) return null;
  const segments = [
    { count: stats.approved, color: "#22c55e" },
    { count: stats.submitted, color: "#eab308" },
    { count: stats.rejected, color: "#ef4444" },
    { count: stats.waived, color: "#818cf8" },
    { count: stats.missing, color: "#e5e7eb" },
  ];
  return (
    <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", width: "100%" }}>
      {segments.map((s, i) => s.count > 0 ? (
        <div key={i} style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color, transition: "width 0.3s" }} />
      ) : null)}
    </div>
  );
}

function UnitCard({ unit, docs, isExpanded, onToggle }) {
  const stats = getStats(docs);
  const pct = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;
  const isComplete = stats.missing === 0 && stats.rejected === 0 && stats.submitted === 0;

  return (
    <div style={{
      border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 12,
      backgroundColor: "var(--bg-card, #fff)", overflow: "hidden",
    }}>
      <div
        onClick={onToggle}
        style={{
          padding: "16px 20px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 16,
          borderBottom: isExpanded ? "1px solid #e5e7eb" : "none",
        }}
      >
        <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace", minWidth: 80 }}>
          {unit.assetId}_{unit.unit}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary, #111)" }}>{unit.tenant}</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{unit.building} — Unit {unit.unit}</div>
        </div>
        <div style={{ width: 160 }}>
          <ProgressBar stats={stats} />
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, textAlign: "right" }}>
            {stats.approved}/{stats.total} approved ({pct}%)
          </div>
        </div>
        <div style={{ minWidth: 90, textAlign: "right" }}>
          {isComplete ? (
            <span style={{ fontSize: 12, fontWeight: 700, color: "#166534", backgroundColor: "#dcfce7", padding: "4px 10px", borderRadius: 4 }}>COMPLETE</span>
          ) : (
            <span style={{ fontSize: 12, fontWeight: 600, color: "#854d0e", backgroundColor: "#fef9c3", padding: "4px 10px", borderRadius: 4 }}>IN PROGRESS</span>
          )}
        </div>
        <span style={{ fontSize: 18, color: "#9ca3af", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>▾</span>
      </div>

      {isExpanded && (
        <div style={{ padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: "var(--bg-header, #f9fafb)" }}>
                {["Document", "Status", "File Name", "Reviewer", "Date", "Rev", "Notes"].map(h => (
                  <th key={h} style={{
                    padding: "10px 12px", textAlign: "left", fontWeight: 600,
                    fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em",
                    color: "#6b7280", borderBottom: "1px solid #e5e7eb",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map((doc, i) => (
                <tr key={i} style={{
                  borderBottom: "1px solid #f3f4f6",
                  backgroundColor: doc.status === "rejected" ? "#fff5f5" : "transparent",
                }}>
                  <td style={{ padding: "10px 12px", fontWeight: 500, color: "var(--text-primary, #111)" }}>{doc.label}</td>
                  <td style={{ padding: "10px 12px" }}><StatusBadge status={doc.status} /></td>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "#6b7280", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.fileName || "—"}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#6b7280" }}>{doc.reviewer || "—"}</td>
                  <td style={{ padding: "10px 12px", color: "#6b7280", whiteSpace: "nowrap" }}>{doc.reviewDate || "—"}</td>
                  <td style={{ padding: "10px 12px", color: "#6b7280", textAlign: "center" }}>
                    {doc.revision > 0 ? `v${doc.revision}` : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: 12, color: "#991b1b", maxWidth: 220 }}>
                    {doc.rejectionReason || ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{
            display: "flex", gap: 24, padding: "14px 20px",
            backgroundColor: "var(--bg-header, #f9fafb)",
            borderTop: "1px solid #e5e7eb", fontSize: 12, color: "#6b7280",
          }}>
            <span><strong style={{ color: "#22c55e" }}>{stats.approved}</strong> Approved</span>
            <span><strong style={{ color: "#eab308" }}>{stats.submitted}</strong> Awaiting Review</span>
            <span><strong style={{ color: "#ef4444" }}>{stats.rejected}</strong> Rejected</span>
            <span><strong style={{ color: "#9ca3af" }}>{stats.missing}</strong> Missing</span>
            <span><strong style={{ color: "#818cf8" }}>{stats.waived}</strong> Waived</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentTracker() {
  const [expandedUnit, setExpandedUnit] = useState("S0001_1");
  const [filterStatus, setFilterStatus] = useState("all");

  const allDocs = Object.values(DOCUMENTS).flat();
  const totalAll = allDocs.filter(d => d.status !== "waived").length;
  const approvedAll = allDocs.filter(d => d.status === "approved").length;
  const needsAttention = allDocs.filter(d => d.status === "submitted" || d.status === "rejected" || d.status === "missing").length;

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', -apple-system, sans-serif", maxWidth: 1100, margin: "0 auto", padding: 24 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary, #111)", margin: 0 }}>
            PBV Conversion — Document Tracker
          </h1>
          <span style={{ fontSize: 12, color: "#9ca3af", fontFamily: "monospace" }}>
            Generated 2026-04-22
          </span>
        </div>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          Housing Choice Voucher Program — Application Package Checklist
        </p>
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24,
      }}>
        {[
          { label: "Total Units", value: UNITS.length, color: "#111" },
          { label: "Docs Approved", value: `${approvedAll}/${totalAll}`, color: "#22c55e" },
          { label: "Needs Attention", value: needsAttention, color: "#ef4444" },
          { label: "Units Complete", value: UNITS.filter(u => {
            const docs = DOCUMENTS[`${u.assetId}_${u.unit}`];
            const s = getStats(docs);
            return s.missing === 0 && s.rejected === 0 && s.submitted === 0;
          }).length + `/${UNITS.length}`, color: "#3b82f6" },
        ].map((stat, i) => (
          <div key={i} style={{
            padding: "16px 20px", borderRadius: 8, border: "1px solid #e5e7eb",
            backgroundColor: "var(--bg-card, #fff)",
          }}>
            <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{stat.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["all", "needs_review", "rejected", "missing"].map(f => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            style={{
              padding: "6px 14px", borderRadius: 4, border: "1px solid #e5e7eb",
              backgroundColor: filterStatus === f ? "#111" : "var(--bg-card, #fff)",
              color: filterStatus === f ? "#fff" : "#6b7280",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            {f === "all" ? "All Units" : f === "needs_review" ? "Needs Review" : f === "rejected" ? "Has Rejections" : "Has Missing"}
          </button>
        ))}
      </div>

      {UNITS.filter(u => {
        if (filterStatus === "all") return true;
        const docs = DOCUMENTS[`${u.assetId}_${u.unit}`];
        if (filterStatus === "needs_review") return docs.some(d => d.status === "submitted");
        if (filterStatus === "rejected") return docs.some(d => d.status === "rejected");
        if (filterStatus === "missing") return docs.some(d => d.status === "missing");
        return true;
      }).map(u => {
        const key = `${u.assetId}_${u.unit}`;
        return (
          <UnitCard
            key={key}
            unit={u}
            docs={DOCUMENTS[key]}
            isExpanded={expandedUnit === key}
            onToggle={() => setExpandedUnit(expandedUnit === key ? null : key)}
          />
        );
      })}

      <div style={{ marginTop: 24, padding: "16px 20px", borderRadius: 8, backgroundColor: "var(--bg-header, #f9fafb)", border: "1px solid #e5e7eb" }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#9ca3af", marginBottom: 8 }}>
          File Naming Convention
        </div>
        <code style={{ fontSize: 12, color: "#6b7280", fontFamily: "monospace" }}>
          {"{AssetID}_{Unit} - {DocType} - {LastName} - {YYYYMMDD} - v{Revision}.{ext}"}
        </code>
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>
          Example: S0001_1 - Paystubs - Garcia - 20260422 - v1.pdf
        </div>
      </div>
    </div>
  );
}
