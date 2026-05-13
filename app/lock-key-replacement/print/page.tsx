export const metadata = {
  title: 'Key Fob / Lock Replacement Authorization — Printable | Stanton Management',
};

export default function LockKeyReplacementPrintPage() {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
        body { font-family: 'Times New Roman', Times, serif; background: #fff; color: #000; margin: 0; padding: 0; }
        .form-page { max-width: 8.5in; margin: 0 auto; padding: 0.65in 0.75in 0.65in 0.75in; font-size: 10.5pt; line-height: 1.4; }
        .header { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8pt; margin-bottom: 14pt; }
        .header-left { font-size: 9pt; line-height: 1.5; }
        .header-title { font-size: 15pt; font-weight: bold; letter-spacing: 0.04em; text-align: right; }
        .header-sub { font-size: 9pt; text-align: right; color: #444; }
        .section-title { font-size: 11pt; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 2pt; margin: 14pt 0 8pt 0; text-transform: uppercase; letter-spacing: 0.05em; }
        .field-row { display: flex; gap: 16pt; margin-bottom: 10pt; }
        .field { flex: 1; }
        .field.w-2 { flex: 2; }
        .field-label { font-size: 9pt; margin-bottom: 2pt; }
        .field-line { border-bottom: 1px solid #000; min-height: 16pt; width: 100%; }
        .field-line-tall { border-bottom: 1px solid #000; min-height: 28pt; width: 100%; }
        .checkbox-row { display: flex; align-items: baseline; gap: 6pt; margin: 5pt 0; }
        .cb-box { width: 10pt; height: 10pt; border: 1pt solid #000; display: inline-block; flex-shrink: 0; position: relative; top: 1pt; }
        p { margin: 0 0 6pt 0; }
        table { width: 100%; border-collapse: collapse; margin: 8pt 0; font-size: 10pt; }
        th { font-size: 9pt; font-weight: bold; text-align: left; border: 1px solid #000; padding: 4pt 6pt; background: #f0f0f0; }
        td { border: 1px solid #000; padding: 6pt 6pt; min-height: 18pt; }
        td.blank { background: #fff; }
        .auth-text { font-size: 10pt; margin: 10pt 0; }
        .sig-block { display: flex; gap: 40pt; margin-top: 24pt; }
        .sig-item { flex: 1; }
        .sig-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.08em; color: #444; margin-bottom: 3pt; }
        .sig-line { border-bottom: 1px solid #000; min-height: 24pt; }
        .sig-date { font-size: 8pt; color: #444; margin-top: 3pt; }
        .office-use { border-top: 1.5px solid #000; margin-top: 20pt; padding-top: 8pt; font-size: 9pt; }
        .office-field-row { display: flex; gap: 16pt; margin-top: 8pt; }
        .footer { margin-top: 28pt; border-top: 1px solid #ccc; padding-top: 6pt; font-size: 8pt; color: #666; text-align: center; }
        .print-btn { display: block; text-align: center; margin: 24px auto 0; }
        .print-btn button { font-size: 14px; padding: 10px 28px; background: #1a2744; color: #fff; border: none; cursor: pointer; font-family: inherit; letter-spacing: 0.04em; }
        .print-btn button:hover { background: #253560; }
      `}</style>

      <div className="form-page">

        {/* Header */}
        <div className="header">
          <div className="header-left">
            <strong>Stanton Management LLC</strong><br />
            421 Park Street, Hartford, CT 06106<br />
            (860) 993-3401
          </div>
          <div>
            <div className="header-title">KEY FOB / LOCK REPLACEMENT</div>
            <div className="header-sub">Authorization Form</div>
          </div>
        </div>

        {/* Tenant Info */}
        <div className="section-title">Tenant Information</div>

        <div className="field-row">
          <div className="field w-2">
            <div className="field-label">Tenant Name(s)</div>
            <div className="field-line" />
          </div>
          <div className="field">
            <div className="field-label">Date</div>
            <div className="field-line" />
          </div>
        </div>

        <div className="field-row">
          <div className="field w-2">
            <div className="field-label">Building Address</div>
            <div className="field-line" />
          </div>
          <div className="field">
            <div className="field-label">Unit Number</div>
            <div className="field-line" />
          </div>
        </div>

        {/* Reason */}
        <div className="section-title">Reason for Request</div>

        <div className="checkbox-row">
          <span className="cb-box" />
          <span>Lost key(s)</span>
        </div>
        <div className="checkbox-row">
          <span className="cb-box" />
          <span>Lost key fob(s) / access card</span>
        </div>
        <div className="checkbox-row">
          <span className="cb-box" />
          <span>Damaged key(s)</span>
        </div>
        <div className="checkbox-row">
          <span className="cb-box" />
          <span>Lock change requested (security concern — describe below)</span>
        </div>
        <div className="checkbox-row">
          <span className="cb-box" />
          <span>Other: ____________________________________________</span>
        </div>

        <div style={{ marginTop: '10pt' }}>
          <div className="field-label" style={{ fontSize: '9pt', marginBottom: '3pt' }}>Details / Additional Information</div>
          <div className="field-line-tall" />
        </div>

        {/* Items table */}
        <div className="section-title" style={{ marginTop: '14pt' }}>Items Requested</div>

        <table>
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Item</th>
              <th style={{ width: '15%', textAlign: 'center' }}>Quantity</th>
              <th style={{ width: '20%', textAlign: 'center' }}>Est. Cost Each</th>
              <th style={{ width: '25%', textAlign: 'center' }}>Management Use Only</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Unit key</td>
              <td className="blank" />
              <td className="blank" />
              <td className="blank" />
            </tr>
            <tr>
              <td>Mailbox key</td>
              <td className="blank" />
              <td className="blank" />
              <td className="blank" />
            </tr>
            <tr>
              <td>Key fob / access card</td>
              <td className="blank" />
              <td className="blank" />
              <td className="blank" />
            </tr>
            <tr>
              <td>Lock re-key / change</td>
              <td className="blank" />
              <td className="blank" />
              <td className="blank" />
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ textAlign: 'right', fontWeight: 'bold', borderRight: 'none' }}>Total estimated cost to tenant:</td>
              <td colSpan={2} className="blank" />
            </tr>
          </tfoot>
        </table>

        {/* Authorization */}
        <div className="section-title">Authorization</div>

        <p className="auth-text">
          By signing below, I authorize Stanton Management to proceed with the replacement(s) listed above and to charge the associated cost(s) to my account.
        </p>

        <div className="sig-block">
          <div className="sig-item">
            <div className="sig-label">Tenant Signature</div>
            <div className="sig-line" />
            <div className="sig-date">Date: _______________</div>
          </div>
          <div className="sig-item">
            <div className="sig-label">Stanton Management Representative</div>
            <div className="sig-line" />
            <div className="sig-date">Date: _______________</div>
          </div>
        </div>

        {/* Office use */}
        <div className="office-use">
          <strong>Office Use Only</strong>
          <div className="office-field-row">
            <div className="field">
              <div className="field-label" style={{ fontSize: '8pt' }}>Processed by</div>
              <div className="field-line" />
            </div>
            <div className="field">
              <div className="field-label" style={{ fontSize: '8pt' }}>Charge posted to AppFolio</div>
              <div className="field-line" />
            </div>
            <div className="field">
              <div className="field-label" style={{ fontSize: '8pt' }}>Item(s) issued</div>
              <div className="field-line" />
            </div>
          </div>
        </div>

        <div className="footer">
          Stanton Management LLC &nbsp;|&nbsp; 421 Park Street, Hartford CT 06106 &nbsp;|&nbsp; (860) 993-3401 &nbsp;|&nbsp; Printed {today}
        </div>

      </div>

      {/* Print button — hidden when printing */}
      <div className="print-btn no-print">
        <button onClick={() => window.print()}>Print Form</button>
      </div>
    </>
  );
}
