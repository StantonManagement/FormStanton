import { useState, useEffect, useRef } from "react";

// ============================================================
// MOCK DATA
// ============================================================

const REVIEWER = { name: "J. Reyes", agency: "HACH", initials: "JR" };

const QUEUE = {
  needs_first_review: [
    { id: "S0001_1", tenant: "Maria Garcia", building: "31-33 Park St", unit: "1", priority: "high", days_waiting: 3, new_uploads: 2 },
    { id: "S0091_4B", tenant: "Robert Williams", building: "83-91 Park St", unit: "4B", priority: "normal", days_waiting: 1, new_uploads: 0 },
  ],
  awaiting_your_response: [
    { id: "S0024_3N", tenant: "Ana Santos", building: "144-146 Affleck St", unit: "3N", priority: "high", days_waiting: 2, new_uploads: 4, was_rejected: true },
    { id: "S0010_2", tenant: "Lucia Lopez", building: "10 Wolcott St", unit: "2", priority: "normal", days_waiting: 5, new_uploads: 1, was_rejected: true },
  ],
  approved_this_week: [
    { id: "S0001_2A", tenant: "James Thompson", building: "31-33 Park St", unit: "2A", approved_date: "Apr 22" },
    { id: "S0033_1F", tenant: "Wei Chen", building: "31-33 Park St", unit: "1F", approved_date: "Apr 21" },
    { id: "S0179_4", tenant: "Carmen Martinez", building: "179 Affleck St", unit: "4", approved_date: "Apr 19" },
  ],
};

// HUD income limits (50% AMI Hartford CT MSA — 2024 figures, inferred placeholder)
const INCOME_LIMITS_50_AMI = {
  1: 39200, 2: 44800, 3: 50400, 4: 55950, 5: 60450, 6: 64950,
};

const PACKETS = {
  "S0001_1": {
    tenant: "Maria Garcia",
    asset_id: "S0001",
    unit: "1",
    building: "31-33 Park St",
    bedrooms: 2,
    submitted_date: "Apr 18, 2026",
    last_activity: "Apr 22, 2026 (2 new uploads)",
    household: [
      { name: "Maria Garcia", role: "Head of Household", age: 38, citizenship: "U.S. Citizen", ssn_last4: "4521", disabled: false, student: false },
      { name: "Sofia Garcia", role: "Daughter", age: 12, citizenship: "U.S. Citizen", ssn_last4: "8836", disabled: false, student: true },
      { name: "Diego Garcia", role: "Son", age: 8, citizenship: "U.S. Citizen", ssn_last4: "1199", disabled: true, student: true },
    ],
    income: {
      claimed_annual: 42000,
      documented_annual: 42180,
      breakdown: [
        { member: "Maria Garcia", source: "Employment — Hartford Hospital", monthly: 3000, annual: 36000, doc_ref: "Paystubs (4 weekly)" },
        { member: "Diego Garcia", source: "SSI Benefits", monthly: 515, annual: 6180, doc_ref: "SSI Award Letter" },
      ],
    },
    docs: [
      // Application & Forms
      { id: "d1", category: "Application & Signatures", label: "Signed Application (HCV)", status: "approved", versions: [{ v: 1, uploaded: "Apr 18, 9:14am", filename: "S0001_1_application-signed_Garcia_20260418_v1.pdf", size: "2.1 MB" }], review_history: [{ action: "Approved", at: "Apr 19, 11:02am", by: "J. Reyes (HACH)" }] },
      { id: "d2", category: "Application & Signatures", label: "Criminal Background Release", status: "approved", versions: [{ v: 1, uploaded: "Apr 18, 9:14am", filename: "S0001_1_criminal-bg-release_Garcia_20260418_v1.pdf", size: "412 KB" }], review_history: [{ action: "Approved", at: "Apr 19, 11:03am", by: "J. Reyes (HACH)" }] },
      { id: "d3", category: "Application & Signatures", label: "HUD-9886-A (Release of Info)", status: "approved", versions: [{ v: 1, uploaded: "Apr 18, 9:14am", filename: "S0001_1_hud-9886a_Garcia_20260418_v1.pdf", size: "388 KB" }], review_history: [{ action: "Approved", at: "Apr 19, 11:03am", by: "J. Reyes (HACH)" }] },
      { id: "d4", category: "Application & Signatures", label: "Citizenship Declaration", status: "approved", versions: [{ v: 1, uploaded: "Apr 18, 9:14am", filename: "S0001_1_citizenship-decl_Garcia_20260418_v1.pdf", size: "295 KB" }], review_history: [{ action: "Approved", at: "Apr 19, 11:04am", by: "J. Reyes (HACH)" }] },
      { id: "d5", category: "Application & Signatures", label: "Obligations of Family", status: "approved", versions: [{ v: 1, uploaded: "Apr 18, 9:14am", filename: "S0001_1_obligations-family_Garcia_20260418_v1.pdf", size: "302 KB" }], review_history: [{ action: "Approved", at: "Apr 19, 11:04am", by: "J. Reyes (HACH)" }] },
      // Income — has a pending review
      { id: "d6", category: "Income Verification", label: "Paystubs (Employment 1) — 4 weekly", status: "pending", versions: [{ v: 1, uploaded: "Apr 21, 4:32pm", filename: "S0001_1_paystubs_Garcia_20260421_v2.pdf", size: "1.8 MB", note: "Resubmission — replaces v1 (rejected Apr 17: only 2 stubs, dates from January)" }], review_history: [{ action: "Rejected", at: "Apr 17, 2:14pm", by: "J. Reyes (HACH)", reason: "Insufficient — only 2 weekly stubs provided, need 4. Dates were from January, need current." }] },
      { id: "d7", category: "Income Verification", label: "SSI Award Letter (Diego Garcia)", status: "approved", versions: [{ v: 1, uploaded: "Apr 18, 9:14am", filename: "S0001_1_ssi-award_Garcia_20260418_v1.pdf", size: "240 KB" }], review_history: [{ action: "Approved", at: "Apr 19, 11:08am", by: "J. Reyes (HACH)" }] },
      // Assets — has a pending review
      { id: "d8", category: "Assets", label: "Bank Statement — Savings", status: "approved", versions: [{ v: 1, uploaded: "Apr 18, 9:14am", filename: "S0001_1_bankstmt-savings_Garcia_20260418_v1.pdf", size: "488 KB" }], review_history: [{ action: "Approved", at: "Apr 19, 11:11am", by: "J. Reyes (HACH)" }] },
      { id: "d9", category: "Assets", label: "Bank Statement — Checking", status: "pending", versions: [{ v: 1, uploaded: "Apr 22, 8:47am", filename: "S0001_1_bankstmt-checking_Garcia_20260422_v1.pdf", size: "612 KB" }], review_history: [] },
      // Acknowledgments
      { id: "d10", category: "Acknowledgments", label: "EIV Guide Receipt", status: "approved", versions: [{ v: 1, uploaded: "Apr 18, 9:14am", filename: "S0001_1_eiv-receipt_Garcia_20260418_v1.pdf", size: "180 KB" }], review_history: [{ action: "Approved", at: "Apr 19, 11:14am", by: "J. Reyes (HACH)" }] },
      { id: "d11", category: "Acknowledgments", label: "Briefing Docs Certification", status: "missing", versions: [], review_history: [] },
      { id: "d12", category: "Acknowledgments", label: "HACH Authorization Release", status: "approved", versions: [{ v: 1, uploaded: "Apr 18, 9:14am", filename: "S0001_1_hach-release_Garcia_20260418_v1.pdf", size: "285 KB" }], review_history: [{ action: "Approved", at: "Apr 19, 11:14am", by: "J. Reyes (HACH)" }] },
      { id: "d13", category: "Acknowledgments", label: "Debts Owed Acknowledgment", status: "approved", versions: [{ v: 1, uploaded: "Apr 18, 9:14am", filename: "S0001_1_debts-owed-ack_Garcia_20260418_v1.pdf", size: "210 KB" }], review_history: [{ action: "Approved", at: "Apr 19, 11:15am", by: "J. Reyes (HACH)" }] },
      { id: "d14", category: "Citizenship", label: "Citizenship Documents", status: "waived", versions: [], review_history: [{ action: "Waived", at: "Apr 19, 11:05am", by: "J. Reyes (HACH)", reason: "All household members are U.S. citizens" }] },
    ],
  },
};

const REJECT_REASONS = [
  { code: "stale", label: "Document expired or older than 60 days", template: "Hi {tenant}, the {doc} you uploaded is older than 60 days. Please upload your most recent {doc_short}." },
  { code: "illegible", label: "Document illegible / blurry / unreadable", template: "Hi {tenant}, the {doc} you uploaded is too blurry to read. Please re-upload a clear photo or scan." },
  { code: "wrong_member", label: "Wrong household member", template: "Hi {tenant}, the {doc} appears to be for a different household member. Please upload the document for the correct person." },
  { code: "missing_pages", label: "Missing pages or partial document", template: "Hi {tenant}, the {doc} you uploaded is missing pages. Please upload the complete document." },
  { code: "wrong_doc", label: "Not the document requested", template: "Hi {tenant}, this isn't the {doc} we need. Please review and upload the correct document." },
  { code: "insufficient", label: "Insufficient — needs more periods/data", template: "Hi {tenant}, we need additional {doc_short} to complete review. Please upload more recent records." },
  { code: "other", label: "Other (specify below)", template: "Hi {tenant}, please re-submit your {doc}. Reason: {custom}" },
];

// ============================================================
// STYLES
// ============================================================

const COLORS = {
  bg: "#fafaf9",
  panel: "#ffffff",
  border: "#e7e5e4",
  borderStrong: "#d6d3d1",
  text: "#1c1917",
  textMuted: "#78716c",
  textSubtle: "#a8a29e",
  accent: "#0f4c5c",         // deep teal — feels official, modern
  accentLight: "#e6f0f3",
  approve: "#15803d",
  approveLight: "#dcfce7",
  reject: "#b91c1c",
  rejectLight: "#fee2e2",
  pending: "#a16207",
  pendingLight: "#fef9c3",
  missing: "#9ca3af",
  missingLight: "#f3f4f6",
  waived: "#6366f1",
  waivedLight: "#e0e7ff",
};

const FONT = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'SF Mono', Menlo, monospace";

// ============================================================
// PRIMITIVES
// ============================================================

function StatusBadge({ status, size = "md" }) {
  const config = {
    approved: { label: "Approved", bg: COLORS.approveLight, color: COLORS.approve },
    pending: { label: "Awaiting Review", bg: COLORS.pendingLight, color: COLORS.pending },
    rejected: { label: "Rejected", bg: COLORS.rejectLight, color: COLORS.reject },
    missing: { label: "Not Uploaded", bg: COLORS.missingLight, color: COLORS.missing },
    waived: { label: "Waived", bg: COLORS.waivedLight, color: COLORS.waived },
  }[status];
  const padding = size === "sm" ? "2px 7px" : "3px 9px";
  const fontSize = size === "sm" ? 10 : 11;
  return (
    <span style={{
      display: "inline-block", padding, borderRadius: 3, fontSize,
      fontWeight: 600, backgroundColor: config.bg, color: config.color,
      letterSpacing: "0.02em", textTransform: "uppercase", whiteSpace: "nowrap",
    }}>
      {config.label}
    </span>
  );
}

function Button({ children, variant = "secondary", size = "md", onClick, disabled, style = {} }) {
  const variants = {
    primary: { bg: COLORS.accent, color: "#fff", border: COLORS.accent, hoverBg: "#0a3a47" },
    approve: { bg: COLORS.approve, color: "#fff", border: COLORS.approve, hoverBg: "#166534" },
    reject: { bg: "#fff", color: COLORS.reject, border: COLORS.reject, hoverBg: COLORS.rejectLight },
    secondary: { bg: "#fff", color: COLORS.text, border: COLORS.borderStrong, hoverBg: "#f5f5f4" },
    ghost: { bg: "transparent", color: COLORS.textMuted, border: "transparent", hoverBg: "#f5f5f4" },
  }[variant];
  const sizes = {
    sm: { padding: "5px 10px", fontSize: 12 },
    md: { padding: "7px 14px", fontSize: 13 },
    lg: { padding: "10px 18px", fontSize: 14 },
  }[size];
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...sizes,
        backgroundColor: hover && !disabled ? variants.hoverBg : variants.bg,
        color: variants.color,
        border: `1px solid ${variants.border}`,
        borderRadius: 4,
        fontWeight: 600,
        fontFamily: FONT,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background-color 0.12s ease",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Kbd({ children }) {
  return (
    <span style={{
      display: "inline-block", padding: "1px 6px", borderRadius: 3,
      backgroundColor: "#f5f5f4", border: "1px solid " + COLORS.border,
      fontFamily: FONT_MONO, fontSize: 11, fontWeight: 600,
      color: COLORS.text, lineHeight: "16px", minWidth: 16, textAlign: "center",
    }}>
      {children}
    </span>
  );
}

// ============================================================
// QUEUE (left rail)
// ============================================================

function QueueItem({ item, isActive, onClick, group }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "10px 14px", cursor: "pointer",
        backgroundColor: isActive ? COLORS.accentLight : (hover ? "#f5f5f4" : "transparent"),
        borderLeft: isActive ? `3px solid ${COLORS.accent}` : "3px solid transparent",
        transition: "all 0.1s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>{item.tenant}</span>
        {item.priority === "high" && group !== "approved_this_week" && (
          <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: COLORS.reject }} />
        )}
      </div>
      <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONT_MONO, marginBottom: 4 }}>
        {item.id} · {item.building.split(" ").slice(0, 2).join(" ")}
      </div>
      {group === "approved_this_week" ? (
        <div style={{ fontSize: 11, color: COLORS.approve, fontWeight: 500 }}>
          ✓ Approved {item.approved_date}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, fontSize: 11, color: COLORS.textMuted }}>
          <span>{item.days_waiting}d waiting</span>
          {item.new_uploads > 0 && (
            <span style={{ color: COLORS.accent, fontWeight: 600 }}>
              · {item.new_uploads} new
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function QueueGroup({ title, count, items, activeId, onSelect, group, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: `1px solid ${COLORS.border}` }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: "10px 14px", cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "space-between",
          backgroundColor: "#f5f5f4",
        }}
      >
        <span style={{
          fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.06em", color: COLORS.textMuted,
        }}>
          {title}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: COLORS.textMuted,
          fontFamily: FONT_MONO,
        }}>
          {count}
        </span>
      </div>
      {open && items.map(item => (
        <QueueItem
          key={item.id}
          item={item}
          group={group}
          isActive={activeId === item.id}
          onClick={() => onSelect(item.id)}
        />
      ))}
    </div>
  );
}

function Queue({ activeId, onSelect }) {
  return (
    <div style={{
      width: 280, borderRight: `1px solid ${COLORS.border}`,
      backgroundColor: COLORS.panel, overflowY: "auto", flexShrink: 0,
    }}>
      <div style={{ padding: "16px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.textMuted, marginBottom: 4 }}>
          Your Queue
        </div>
        <div style={{ fontSize: 13, color: COLORS.text }}>
          <strong>{QUEUE.needs_first_review.length + QUEUE.awaiting_your_response.length}</strong> packets need your attention
        </div>
      </div>
      <QueueGroup
        title="Needs First Review"
        count={QUEUE.needs_first_review.length}
        items={QUEUE.needs_first_review}
        activeId={activeId}
        onSelect={onSelect}
        group="needs_first_review"
      />
      <QueueGroup
        title="Awaiting Your Response"
        count={QUEUE.awaiting_your_response.length}
        items={QUEUE.awaiting_your_response}
        activeId={activeId}
        onSelect={onSelect}
        group="awaiting_your_response"
      />
      <QueueGroup
        title="Approved This Week"
        count={QUEUE.approved_this_week.length}
        items={QUEUE.approved_this_week}
        activeId={activeId}
        onSelect={onSelect}
        group="approved_this_week"
        defaultOpen={false}
      />
    </div>
  );
}

// ============================================================
// INCOME PANEL — the wow moment
// ============================================================

function IncomePanel({ packet }) {
  const { claimed_annual, documented_annual, breakdown } = packet.income;
  const householdSize = packet.household.length;
  const limit = INCOME_LIMITS_50_AMI[householdSize];
  const delta = documented_annual - claimed_annual;
  const deltaPct = Math.abs(delta / claimed_annual) * 100;
  const withinTolerance = deltaPct < 10 && Math.abs(delta) < 2400;
  const qualifies = documented_annual <= limit;

  return (
    <div style={{
      backgroundColor: COLORS.panel, border: `1px solid ${COLORS.border}`,
      borderRadius: 6, marginBottom: 16,
    }}>
      <div style={{
        padding: "10px 16px", borderBottom: `1px solid ${COLORS.border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, textTransform: "uppercase",
          letterSpacing: "0.06em", color: COLORS.textMuted,
        }}>
          Income & Eligibility
        </div>
        <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONT_MONO }}>
          50% AMI · Hartford CT MSA · HH size {householdSize}
        </div>
      </div>
      <div style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Tenant Claimed
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, fontFamily: FONT_MONO }}>
            ${claimed_annual.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>annual, all sources</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Documented
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, fontFamily: FONT_MONO }}>
            ${documented_annual.toLocaleString()}
          </div>
          <div style={{
            fontSize: 11, marginTop: 2, fontWeight: 600,
            color: withinTolerance ? COLORS.approve : COLORS.pending,
          }}>
            {withinTolerance ? "✓ Within tolerance" : `⚠ ${deltaPct.toFixed(1)}% delta`}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Income Limit
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, fontFamily: FONT_MONO }}>
            ${limit.toLocaleString()}
          </div>
          <div style={{
            fontSize: 11, marginTop: 2, fontWeight: 600,
            color: qualifies ? COLORS.approve : COLORS.reject,
          }}>
            {qualifies ? "✓ Qualifies" : "✗ Over limit"}
          </div>
        </div>
      </div>
      <div style={{
        padding: "10px 16px", backgroundColor: "#fafaf9",
        borderTop: `1px solid ${COLORS.border}`,
        fontSize: 11, color: COLORS.textMuted,
      }}>
        <div style={{ fontWeight: 600, color: COLORS.text, marginBottom: 6, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          How we got there
        </div>
        {breakdown.map((src, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 12, color: COLORS.text }}>
            <span>{src.member} — {src.source}</span>
            <span style={{ fontFamily: FONT_MONO }}>
              ${src.monthly.toLocaleString()}/mo × 12 = ${src.annual.toLocaleString()} <span style={{ color: COLORS.textSubtle }}>({src.doc_ref})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// HOUSEHOLD PANEL
// ============================================================

function HouseholdPanel({ packet }) {
  return (
    <div style={{
      backgroundColor: COLORS.panel, border: `1px solid ${COLORS.border}`,
      borderRadius: 6, marginBottom: 16,
    }}>
      <div style={{
        padding: "10px 16px", borderBottom: `1px solid ${COLORS.border}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.textMuted }}>
          Household
        </div>
        <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONT_MONO }}>
          {packet.household.length} members · {packet.bedrooms} bedroom unit
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ backgroundColor: "#fafaf9" }}>
            {["Name", "Role", "Age", "Citizenship", "SSN", "Flags"].map(h => (
              <th key={h} style={{
                padding: "8px 16px", textAlign: "left", fontWeight: 600, fontSize: 10,
                textTransform: "uppercase", letterSpacing: "0.05em", color: COLORS.textMuted,
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {packet.household.map((m, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${COLORS.border}` }}>
              <td style={{ padding: "10px 16px", fontWeight: 500 }}>{m.name}</td>
              <td style={{ padding: "10px 16px", color: COLORS.textMuted }}>{m.role}</td>
              <td style={{ padding: "10px 16px", color: COLORS.textMuted, fontFamily: FONT_MONO }}>{m.age}</td>
              <td style={{ padding: "10px 16px", color: COLORS.textMuted }}>{m.citizenship}</td>
              <td style={{ padding: "10px 16px", color: COLORS.textMuted, fontFamily: FONT_MONO }}>***-**-{m.ssn_last4}</td>
              <td style={{ padding: "10px 16px" }}>
                {m.disabled && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, backgroundColor: COLORS.waivedLight, color: COLORS.waived, fontWeight: 600, marginRight: 4 }}>DISABLED</span>}
                {m.student && m.age >= 18 && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, backgroundColor: COLORS.pendingLight, color: COLORS.pending, fontWeight: 600 }}>STUDENT</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// DOCUMENT ROW
// ============================================================

function DocRow({ doc, isFocused, onApprove, onReject, onView, onClick }) {
  const [hover, setHover] = useState(false);
  const latestVersion = doc.versions[doc.versions.length - 1];
  const lastReview = doc.review_history[doc.review_history.length - 1];

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "12px 16px",
        borderTop: `1px solid ${COLORS.border}`,
        backgroundColor: isFocused ? COLORS.accentLight : (hover ? "#fafaf9" : "transparent"),
        borderLeft: isFocused ? `3px solid ${COLORS.accent}` : "3px solid transparent",
        cursor: "pointer",
        transition: "all 0.1s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>{doc.label}</span>
            <StatusBadge status={doc.status} size="sm" />
          </div>
          {latestVersion && (
            <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONT_MONO, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {latestVersion.filename} · {latestVersion.size} · v{latestVersion.v}
            </div>
          )}
          {!latestVersion && doc.status === "missing" && (
            <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic" }}>
              Not yet uploaded · Stanton notified to chase tenant
            </div>
          )}
          {!latestVersion && doc.status === "waived" && (
            <div style={{ fontSize: 11, color: COLORS.textMuted, fontStyle: "italic" }}>
              {lastReview?.reason}
            </div>
          )}
          {latestVersion?.note && (
            <div style={{
              fontSize: 11, color: COLORS.pending, marginTop: 4,
              padding: "4px 8px", backgroundColor: COLORS.pendingLight,
              borderRadius: 3, display: "inline-block",
            }}>
              ↻ {latestVersion.note}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {doc.status === "pending" && (
            <>
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onView(doc); }}>View</Button>
              <Button size="sm" variant="approve" onClick={(e) => { e.stopPropagation(); onApprove(doc.id); }}>
                Approve
              </Button>
              <Button size="sm" variant="reject" onClick={(e) => { e.stopPropagation(); onReject(doc); }}>
                Reject
              </Button>
            </>
          )}
          {doc.status === "approved" && (
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onView(doc); }}>View</Button>
          )}
        </div>
      </div>
      {/* receipts hover */}
      {doc.review_history.length > 0 && (
        <div style={{
          fontSize: 11, color: COLORS.textSubtle, marginTop: 6,
          paddingLeft: 0,
        }}>
          {doc.review_history.map((h, i) => (
            <div key={i}>
              {h.action} {h.at} by {h.by}{h.reason ? ` — ${h.reason}` : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// REJECT DIALOG
// ============================================================

function RejectDialog({ doc, packet, onClose, onSubmit }) {
  const [reasonCode, setReasonCode] = useState("stale");
  const [customNote, setCustomNote] = useState("");
  const reason = REJECT_REASONS.find(r => r.code === reasonCode);

  const tenantFirstName = packet.tenant.split(" ")[0];
  const docShort = doc.label.split(" ")[0].toLowerCase();
  const previewMessage = reason.template
    .replace("{tenant}", tenantFirstName)
    .replace("{doc}", doc.label)
    .replace("{doc_short}", docShort)
    .replace("{custom}", customNote || "[your note here]");

  return (
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "rgba(28, 25, 23, 0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 100, padding: 20,
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: COLORS.panel, borderRadius: 8, width: "100%", maxWidth: 560,
          boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ padding: "18px 22px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: COLORS.reject, marginBottom: 4 }}>
            Reject Document
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>{doc.label}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
            {packet.tenant} · {packet.building}, Unit {packet.unit}
          </div>
        </div>

        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>
            Reason
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {REJECT_REASONS.map(r => (
              <label key={r.code} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                border: `1px solid ${reasonCode === r.code ? COLORS.accent : COLORS.border}`,
                backgroundColor: reasonCode === r.code ? COLORS.accentLight : "transparent",
                borderRadius: 4, cursor: "pointer", fontSize: 13,
              }}>
                <input
                  type="radio"
                  checked={reasonCode === r.code}
                  onChange={() => setReasonCode(r.code)}
                  style={{ accentColor: COLORS.accent }}
                />
                {r.label}
              </label>
            ))}
          </div>

          {reasonCode === "other" && (
            <textarea
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Specify reason..."
              style={{
                width: "100%", marginTop: 10, padding: 10, fontSize: 13, fontFamily: FONT,
                border: `1px solid ${COLORS.border}`, borderRadius: 4, minHeight: 60, resize: "vertical",
              }}
            />
          )}

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: COLORS.textMuted, marginBottom: 6 }}>
              Tenant will receive (SMS, in their language):
            </div>
            <div style={{
              padding: 12, backgroundColor: "#fafaf9", borderRadius: 4,
              border: `1px solid ${COLORS.border}`, fontSize: 13,
              color: COLORS.text, lineHeight: 1.5,
            }}>
              {previewMessage}
            </div>
            <div style={{ fontSize: 11, color: COLORS.textSubtle, marginTop: 6 }}>
              Stanton will be notified and will follow up if the tenant doesn't respond within 48 hours.
            </div>
          </div>
        </div>

        <div style={{
          padding: "14px 22px", borderTop: `1px solid ${COLORS.border}`,
          display: "flex", justifyContent: "flex-end", gap: 8,
          backgroundColor: "#fafaf9", borderRadius: "0 0 8px 8px",
        }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="reject" onClick={() => onSubmit(doc.id, reasonCode, reason.label, customNote)}>
            Reject & Notify Tenant
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DOCUMENT VIEWER
// ============================================================

function DocViewer({ doc, onClose }) {
  const v = doc.versions[doc.versions.length - 1];
  return (
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "rgba(28, 25, 23, 0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20,
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: COLORS.panel, borderRadius: 8, width: "100%", maxWidth: 720,
          maxHeight: "90vh", display: "flex", flexDirection: "column",
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
        }}
      >
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{doc.label}</div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONT_MONO, marginTop: 2 }}>
              {v?.filename} · {v?.size}
            </div>
          </div>
          <Button variant="ghost" onClick={onClose}>Close ✕</Button>
        </div>
        <div style={{
          flex: 1, padding: 30, overflow: "auto", display: "flex",
          alignItems: "center", justifyContent: "center", backgroundColor: "#f5f5f4",
        }}>
          <div style={{
            width: "100%", maxWidth: 500, aspectRatio: "8.5/11",
            backgroundColor: "#fff", padding: 40,
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)", fontFamily: FONT_MONO,
            fontSize: 11, color: "#333", lineHeight: 1.6,
          }}>
            <div style={{ borderBottom: "2px solid #333", paddingBottom: 12, marginBottom: 20, textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>HARTFORD HOSPITAL</div>
              <div style={{ fontSize: 10, color: "#666" }}>Earnings Statement · Period: Apr 7 – Apr 13, 2026</div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div><strong>Employee:</strong> Maria Garcia</div>
              <div><strong>Employee ID:</strong> HH-44521</div>
              <div><strong>Pay Date:</strong> 04/18/2026</div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14, fontSize: 11 }}>
              <tr style={{ borderBottom: "1px solid #ccc" }}>
                <td style={{ padding: 4 }}>Regular hours (40)</td>
                <td style={{ padding: 4, textAlign: "right" }}>$720.00</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #ccc" }}>
                <td style={{ padding: 4 }}>Overtime (2)</td>
                <td style={{ padding: 4, textAlign: "right" }}>$54.00</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #ccc" }}>
                <td style={{ padding: 4 }}>Federal tax</td>
                <td style={{ padding: 4, textAlign: "right" }}>($83.20)</td>
              </tr>
              <tr style={{ borderBottom: "1px solid #ccc" }}>
                <td style={{ padding: 4 }}>State tax / FICA</td>
                <td style={{ padding: 4, textAlign: "right" }}>($61.40)</td>
              </tr>
              <tr style={{ fontWeight: 700 }}>
                <td style={{ padding: 4 }}>Net pay</td>
                <td style={{ padding: 4, textAlign: "right" }}>$629.40</td>
              </tr>
            </table>
            <div style={{ fontSize: 10, color: "#999", marginTop: 30, textAlign: "center" }}>
              [ Document preview — actual file rendered from Supabase storage ]
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PACKET VIEW
// ============================================================

function PacketView({ packet, onApprove, onReject, onView, focusedDocId }) {
  const stats = {
    approved: packet.docs.filter(d => d.status === "approved").length,
    pending: packet.docs.filter(d => d.status === "pending").length,
    rejected: packet.docs.filter(d => d.status === "rejected").length,
    missing: packet.docs.filter(d => d.status === "missing").length,
    waived: packet.docs.filter(d => d.status === "waived").length,
    total: packet.docs.length,
  };
  const reviewable = stats.total - stats.waived - stats.missing;
  const ready = stats.pending === 0 && stats.rejected === 0 && stats.missing === 0;

  // Group docs by category
  const grouped = packet.docs.reduce((acc, d) => {
    if (!acc[d.category]) acc[d.category] = [];
    acc[d.category].push(d);
    return acc;
  }, {});

  return (
    <div style={{ flex: 1, overflowY: "auto", backgroundColor: COLORS.bg }}>
      {/* Header */}
      <div style={{
        backgroundColor: COLORS.panel, borderBottom: `1px solid ${COLORS.border}`,
        padding: "20px 32px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONT_MONO, marginBottom: 4 }}>
              {packet.asset_id}_{packet.unit} · Submitted {packet.submitted_date} · Last activity {packet.last_activity}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, margin: 0, letterSpacing: "-0.01em" }}>
              {packet.tenant}
            </h1>
            <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 2 }}>
              {packet.building} · Unit {packet.unit}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary">Email Stanton</Button>
            <Button variant="primary" disabled={!ready}>
              {ready ? "Issue Voucher" : `${stats.pending + stats.missing} items pending`}
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 12 }}>
          <div style={{
            height: 6, borderRadius: 3, overflow: "hidden", display: "flex",
            backgroundColor: "#e5e5e4",
          }}>
            <div style={{ width: `${(stats.approved / reviewable) * 100}%`, backgroundColor: COLORS.approve }} />
            <div style={{ width: `${(stats.pending / reviewable) * 100}%`, backgroundColor: COLORS.pending }} />
            <div style={{ width: `${(stats.rejected / reviewable) * 100}%`, backgroundColor: COLORS.reject }} />
          </div>
          <div style={{
            display: "flex", gap: 18, marginTop: 8, fontSize: 12, color: COLORS.textMuted,
          }}>
            <span><strong style={{ color: COLORS.approve }}>{stats.approved}</strong> approved</span>
            <span><strong style={{ color: COLORS.pending }}>{stats.pending}</strong> awaiting review</span>
            <span><strong style={{ color: COLORS.reject }}>{stats.rejected}</strong> rejected</span>
            <span><strong style={{ color: COLORS.missing }}>{stats.missing}</strong> not uploaded</span>
            <span><strong style={{ color: COLORS.waived }}>{stats.waived}</strong> waived</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "20px 32px" }}>
        <IncomePanel packet={packet} />
        <HouseholdPanel packet={packet} />

        {/* Docs by category */}
        {Object.entries(grouped).map(([category, docs]) => (
          <div key={category} style={{
            backgroundColor: COLORS.panel, border: `1px solid ${COLORS.border}`,
            borderRadius: 6, marginBottom: 16, overflow: "hidden",
          }}>
            <div style={{
              padding: "10px 16px", backgroundColor: "#fafaf9",
              borderBottom: `1px solid ${COLORS.border}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.06em", color: COLORS.textMuted,
              }}>
                {category}
              </div>
              <div style={{ fontSize: 11, color: COLORS.textMuted, fontFamily: FONT_MONO }}>
                {docs.filter(d => d.status === "approved").length}/{docs.filter(d => d.status !== "waived").length} approved
              </div>
            </div>
            {docs.map(doc => (
              <DocRow
                key={doc.id}
                doc={doc}
                isFocused={focusedDocId === doc.id}
                onApprove={onApprove}
                onReject={onReject}
                onView={onView}
                onClick={() => {}}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// HEADER
// ============================================================

function Header() {
  return (
    <div style={{
      height: 52, backgroundColor: COLORS.text, color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px", flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 28, height: 28, backgroundColor: COLORS.accent,
          borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 800, letterSpacing: "-0.02em",
        }}>
          PBV
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>HACH Reviewer</div>
          <div style={{ fontSize: 10, color: "#a8a29e", letterSpacing: "0.02em" }}>
            Hartford Housing Authority · Stanton Management portfolio
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 12, color: "#d6d3d1" }}>
          {REVIEWER.name} · {REVIEWER.agency}
        </div>
        <div style={{
          width: 30, height: 30, borderRadius: "50%", backgroundColor: COLORS.accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700,
        }}>
          {REVIEWER.initials}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// KEYBOARD SHORTCUTS BAR
// ============================================================

function ShortcutsBar({ toast }) {
  return (
    <div style={{
      height: 36, backgroundColor: COLORS.panel,
      borderTop: `1px solid ${COLORS.border}`,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 20px", flexShrink: 0, fontSize: 11, color: COLORS.textMuted,
    }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
        <span><Kbd>J</Kbd> <Kbd>K</Kbd> next/prev</span>
        <span><Kbd>A</Kbd> approve</span>
        <span><Kbd>R</Kbd> reject</span>
        <span><Kbd>V</Kbd> view document</span>
        <span><Kbd>?</Kbd> all shortcuts</span>
      </div>
      <div style={{
        opacity: toast ? 1 : 0, transition: "opacity 0.3s",
        color: toast?.type === "success" ? COLORS.approve : COLORS.reject,
        fontWeight: 600,
      }}>
        {toast?.message}
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================

export default function HACHReviewerPrototype() {
  const [activeId, setActiveId] = useState("S0001_1");
  const [packets, setPackets] = useState(PACKETS);
  const [rejectingDoc, setRejectingDoc] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [toast, setToast] = useState(null);
  const [focusedDocId, setFocusedDocId] = useState(null);

  const activePacket = packets[activeId];

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2800);
  };

  const handleApprove = (docId) => {
    setPackets(prev => ({
      ...prev,
      [activeId]: {
        ...prev[activeId],
        docs: prev[activeId].docs.map(d => d.id === docId ? {
          ...d,
          status: "approved",
          review_history: [...d.review_history, {
            action: "Approved",
            at: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
            by: `${REVIEWER.name} (${REVIEWER.agency})`,
          }],
        } : d),
      },
    }));
    const doc = activePacket.docs.find(d => d.id === docId);
    showToast(`✓ Approved · ${doc.label}`, "success");
  };

  const handleReject = (docId, reasonCode, reasonLabel, customNote) => {
    setPackets(prev => ({
      ...prev,
      [activeId]: {
        ...prev[activeId],
        docs: prev[activeId].docs.map(d => d.id === docId ? {
          ...d,
          status: "rejected",
          review_history: [...d.review_history, {
            action: "Rejected",
            at: new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }),
            by: `${REVIEWER.name} (${REVIEWER.agency})`,
            reason: customNote || reasonLabel,
          }],
        } : d),
      },
    }));
    const doc = activePacket.docs.find(d => d.id === docId);
    setRejectingDoc(null);
    showToast(`✗ Rejected · Tenant notified by SMS`, "reject");
  };

  return (
    <div style={{
      height: "100vh", display: "flex", flexDirection: "column",
      fontFamily: FONT, backgroundColor: COLORS.bg, color: COLORS.text,
    }}>
      <Header />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <Queue activeId={activeId} onSelect={setActiveId} />
        {activePacket ? (
          <PacketView
            packet={activePacket}
            onApprove={handleApprove}
            onReject={setRejectingDoc}
            onView={setViewingDoc}
            focusedDocId={focusedDocId}
          />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.textMuted }}>
            Select a packet from your queue
          </div>
        )}
      </div>
      <ShortcutsBar toast={toast} />

      {rejectingDoc && (
        <RejectDialog
          doc={rejectingDoc}
          packet={activePacket}
          onClose={() => setRejectingDoc(null)}
          onSubmit={handleReject}
        />
      )}
      {viewingDoc && (
        <DocViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />
      )}
    </div>
  );
}
