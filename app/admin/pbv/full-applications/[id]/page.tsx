'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import StantonReviewSurface from '@/components/review/StantonReviewSurface';
import SendToHachDialog from '@/components/review/SendToHachDialog';
import ReopenPacketDialog from '@/components/review/ReopenPacketDialog';
import PacketLockBanner from '@/components/review/PacketLockBanner';

interface Member { id:string;slot:number;name:string;age:number|null;relationship:string;ssn_last_four:string|null;annual_income:number;documented_income:number|null;income_sources:string[];disability:boolean;student:boolean;citizenship_status:string;criminal_history:boolean|null;signature_required:boolean;signature_date:string|null;signed_forms:string[]; }
interface Doc { id:string;doc_type:string;label:string;person_slot:number;status:string;required:boolean;display_order:number;requires_signature:boolean;revision?:number;file_name?:string|null;storage_path?:string|null;uploaded_by_role?:string|null;uploaded_by_display_name?:string|null;staff_upload_note?:string|null;original_doc_type?:string|null; }
interface AppDetail { id:string;created_at:string;head_of_household_name:string;building_address:string;unit_number:string;bedroom_count:number|null;household_size:number;intake_submitted_at:string|null;stanton_review_status:string;stanton_reviewer:string|null;stanton_review_date:string|null;stanton_review_notes:string|null;hha_application_file:string|null;tenant_access_token:string;form_submission_id:string;magic_link:string;claiming_medical_deduction:boolean;has_childcare_expense:boolean;dv_status:boolean;homeless_at_admission:boolean;reasonable_accommodation_requested:boolean;packet_locked:boolean;submitted_to_hach_at:string|null;hach_packet_revision:number;hach_review_status:string|null;members:Member[];documents:Doc[]; }

const STATUS_LABELS:Record<string,string> = {pending:'Pending',under_review:'Under Review',needs_info:'Needs Info',approved:'Approved',denied:'Denied'};
const STATUS_COLORS:Record<string,string> = {pending:'bg-gray-100 text-gray-700',under_review:'bg-yellow-100 text-yellow-800',needs_info:'bg-orange-100 text-orange-800',approved:'bg-green-100 text-green-800',denied:'bg-red-100 text-red-800'};
const DOC_COLORS:Record<string,string> = {approved:'bg-green-100 text-green-800',submitted:'bg-yellow-100 text-yellow-800',rejected:'bg-red-100 text-red-800',missing:'bg-gray-100 text-gray-600',waived:'bg-indigo-100 text-indigo-800'};

function fmtDate(s:string|null|undefined){if(!s)return'—';return new Date(s).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'});}
function fmtMoney(n:number|null|undefined){if(n==null)return'—';return '$'+n.toLocaleString('en-US',{minimumFractionDigits:0});}

export default function PbvFullApplicationDetailPage() {
  const { id } = useParams<{id:string}>();
  const [detail, setDetail] = useState<AppDetail|null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [incomeEdits, setIncomeEdits] = useState<Record<string,string>>({});
  const [reviewStatus, setReviewStatus] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [generatingHha, setGeneratingHha] = useState(false);
  const [hhaMsg, setHhaMsg] = useState('');
  const [exportingHach, setExportingHach] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showSendToHach, setShowSendToHach] = useState(false);
  const [showReopen, setShowReopen] = useState(false);
  const [sendToHachPermission, setSendToHachPermission] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true); setFetchError('');
    try {
      const res = await fetch('/api/admin/pbv/full-applications/'+id);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Failed to load');
      const d:AppDetail = json.data;
      setDetail(d);
      setReviewStatus(d.stanton_review_status);
      setReviewerName(d.stanton_reviewer??'');
      setReviewNotes(d.stanton_review_notes??'');
      const edits:Record<string,string>={};
      for(const m of d.members) edits[m.id]=m.documented_income!=null?String(m.documented_income):'';
      setIncomeEdits(edits);
    } catch(e:unknown){ setFetchError(e instanceof Error?e.message:'Failed to load'); }
    finally{ setLoading(false); }
  },[id]);

  const ANCHOR_TYPE = 'pbv_full_application';

  // Document action handler for unified review surface
  const handleDocumentAction = useCallback(async (action: string, docId: string, data?: any) => {
    if (!detail) return;
    
    try {
      let url = '';
      let body: any = {};
      
      switch (action) {
        case 'approve':
          url = `/api/admin/applications/${ANCHOR_TYPE}/${detail.id}/documents/${docId}/approve`;
          break;
        case 'reject':
          url = `/api/admin/applications/${ANCHOR_TYPE}/${detail.id}/documents/${docId}/reject`;
          body = {
            reason_code: data?.reasonCode,
            reason_text: data?.reasonText,
            internal_notes: data?.internalNotes,
          };
          break;
        case 'waive':
          url = `/api/admin/applications/${ANCHOR_TYPE}/${detail.id}/documents/${docId}/waive`;
          break;
        case 'refresh':
          await fetchDetail();
          return;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || `${action} failed`);
      }
      
      // Refresh data to get updated document status
      await fetchDetail();
    } catch (error: any) {
      throw new Error(error.message || `${action} failed`);
    }
  }, [detail, fetchDetail]);

  useEffect(()=>{ fetchDetail(); },[fetchDetail]);

  // Fetch send_to_hach permission once
  useEffect(()=>{
    fetch(`/api/admin/pbv/full-applications/${id}/preflight`)
      .then(r=>r.json())
      .then(j=>{ if(j.success) setSendToHachPermission(j.data.permission_held); })
      .catch(()=>{});
  },[id]);

  const handleSave = async () => {
    if(!detail)return;
    setSaving(true); setSaveMsg('');
    try {
      const res = await fetch('/api/admin/pbv/full-applications/'+id,{
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          stanton_review_status:reviewStatus,
          stanton_reviewer:reviewerName.trim()||null,
          stanton_review_notes:reviewNotes.trim()||null,
          member_income_updates:detail.members.map(m=>({id:m.id,documented_income:incomeEdits[m.id]!==''?parseFloat(incomeEdits[m.id])||null:null})),
        }),
      });
      const json = await res.json();
      if(!json.success) throw new Error(json.message||'Save failed');
      setSaveMsg('Saved.'); await fetchDetail();
    } catch(e:unknown){ setSaveMsg(e instanceof Error?e.message:'Save failed'); }
    finally{ setSaving(false); setTimeout(()=>setSaveMsg(''),3000); }
  };

  const handleGenerateHha = async () => {
    if(!detail)return;
    setGeneratingHha(true); setHhaMsg('');
    try {
      const res = await fetch('/api/admin/pbv/full-applications/'+id+'/hha',{method:'POST'});
      if(res.ok && res.headers.get('content-type')?.includes('wordprocessingml')){
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href=url;
        const match=res.headers.get('content-disposition')?.match(/filename="([^"]+)"/);
        a.download=match?.[1]??'hha_application.docx'; a.click(); URL.revokeObjectURL(url);
        setHhaMsg('Downloaded.'); await fetchDetail();
      } else {
        const json = await res.json();
        throw new Error(json.message||'Generation failed');
      }
    } catch(e:unknown){ setHhaMsg(e instanceof Error?e.message:'Generation failed'); }
    finally{ setGeneratingHha(false); }
  };

  const handleExportHach = async () => {
    if(!detail)return;
    setExportingHach(true);
    try {
      const res = await fetch('/api/admin/pbv/full-applications/'+id+'/export');
      if(!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href=url;
      const match=res.headers.get('content-disposition')?.match(/filename="([^"]+)"/);
      a.download=match?.[1]??'hach_package.zip'; a.click(); URL.revokeObjectURL(url);
    } catch(e:unknown){ alert(e instanceof Error?e.message:'Export failed'); }
    finally{ setExportingHach(false); }
  };

  if(loading) return <div className="p-8 text-sm text-[var(--muted)]">Loading...</div>;
  if(fetchError||!detail) return <div className="p-8 text-sm text-red-600">{fetchError||'Not found'}</div>;

  const requiredDocs = detail.documents.filter(d=>d.required);
  const allRequiredApproved = requiredDocs.length>0 && requiredDocs.every(d=>d.status==='approved'||d.status==='waived');
  const canGenerateHha = allRequiredApproved && reviewStatus==='approved';
  const totalClaimed = detail.members.reduce((s,m)=>s+(m.annual_income??0),0);
  const sigRequired = detail.members.filter(m=>m.signature_required).length;
  const signedCount = detail.members.filter(m=>m.signature_required&&m.signed_forms.length>0).length;

  // Fix 9: precise HHA blocking reason
  const hhaBlockReason = canGenerateHha ? null
    : reviewStatus !== 'approved' && !allRequiredApproved
      ? `Review status must be Approved and all required documents must be approved or waived (${requiredDocs.filter(d=>d.status!=='approved'&&d.status!=='waived').length} remaining).`
      : reviewStatus !== 'approved'
        ? 'Review status must be set to Approved before generating the HHA application.'
        : `${requiredDocs.filter(d=>d.status!=='approved'&&d.status!=='waived').length} required document(s) still need to be approved or waived.`;

  // Fix 4: orphaned sig-doc slots — sig required doc exists but person_slot has no adult signer
  const adultSlots = new Set(detail.members.filter(m=>m.signature_required).map(m=>m.slot));
  const orphanedSigDocs = detail.documents.filter(d=>d.requires_signature && d.person_slot>0 && !adultSlots.has(d.person_slot));
  const docCounts:Record<string,number>={approved:0,submitted:0,rejected:0,missing:0,waived:0};
  for(const d of detail.documents) docCounts[d.status]=(docCounts[d.status]??0)+1;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="text-sm">
        <Link href="/admin/pbv/full-applications" className="text-[var(--muted)] hover:text-[var(--ink)] underline">Back to Full Applications</Link>
      </div>

      {detail.packet_locked && (
        <PacketLockBanner
          submittedAt={detail.submitted_to_hach_at}
          revision={detail.hach_packet_revision}
          canReopen={sendToHachPermission}
          onReopen={()=>setShowReopen(true)}
        />
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-serif text-[var(--primary)]">{detail.head_of_household_name}</h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            {detail.building_address} Unit {detail.unit_number}
            {detail.bedroom_count ? ' · '+detail.bedroom_count+' BR' : ''}
            {' · '}{detail.household_size} person{detail.household_size!==1?'s':''}
          </p>
        </div>
        <span className={'px-3 py-1 text-xs font-semibold '+(STATUS_COLORS[detail.stanton_review_status]??'bg-gray-100 text-gray-700')}>
          {STATUS_LABELS[detail.stanton_review_status]??detail.stanton_review_status}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        {[
          {label:'Invited',value:fmtDate(detail.created_at)},
          {label:'Intake Submitted',value:fmtDate(detail.intake_submitted_at)},
          {label:'Signatures',value:signedCount+' / '+sigRequired},
          {label:'Docs Approved',value:(docCounts.approved+docCounts.waived)+' / '+requiredDocs.length+' req'},
        ].map(item=>(
          <div key={item.label} className="bg-white border border-[var(--border)] p-3">
            <p className="text-xs text-[var(--muted)] uppercase tracking-wide font-medium mb-1">{item.label}</p>
            <p className="font-semibold text-[var(--ink)]">{item.value}</p>
          </div>
        ))}
      </div>

      {orphanedSigDocs.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-900">
          <p className="font-semibold mb-1">Signature documents with no assigned signer</p>
          <p className="text-xs text-amber-800 mb-2">
            The following signature-required documents are assigned to person slots that have no adult signer on record.
            They cannot be fulfilled by the tenant. Waive them or investigate the household member data.
          </p>
          <ul className="list-disc list-inside text-xs space-y-0.5">
            {orphanedSigDocs.map(d=>(
              <li key={d.id}>{d.label} (slot {d.person_slot})</li>
            ))}
          </ul>
        </div>
      )}

      <section className="bg-white border border-[var(--border)]">
        <div className="px-5 py-3 border-b border-[var(--divider)]">
          <h2 className="text-sm font-semibold text-[var(--primary)] uppercase tracking-wide">Qualification — Income Review</h2>
          <p className="text-xs text-[var(--muted)] mt-0.5">Enter documented income per member. Delta 10% flagged.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--divider)] bg-[var(--bg-section)]">
                <th className="text-left px-4 py-2 font-medium text-[var(--muted)]">Member</th>
                <th className="text-left px-4 py-2 font-medium text-[var(--muted)]">Rel.</th>
                <th className="text-right px-4 py-2 font-medium text-[var(--muted)]">Claimed</th>
                <th className="text-right px-4 py-2 font-medium text-[var(--muted)]">Documented</th>
                <th className="text-right px-4 py-2 font-medium text-[var(--muted)]">Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--divider)]">
              {detail.members.map(m=>{
                const claimed=m.annual_income??0;
                const raw=incomeEdits[m.id]!==''?parseFloat(incomeEdits[m.id]??''):null;
                const documented=(raw!=null&&!isNaN(raw))?raw:null;
                const diff=documented!=null?documented-claimed:null;
                const pct=claimed>0&&diff!=null?Math.abs(diff)/claimed:0;
                return (
                  <tr key={m.id} className="hover:bg-[var(--bg-section)]">
                    <td className="px-4 py-3">
                      <span className="font-medium text-[var(--ink)]">{m.name}</span>
                      {m.age!=null&&<span className="text-xs text-[var(--muted)] ml-2">{m.age} yr</span>}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">{m.relationship}</td>
                    <td className="px-4 py-3 text-right text-[var(--ink)]">{fmtMoney(claimed)}</td>
                    <td className="px-4 py-3 text-right">
                      <input type="number" min="0" step="100" value={incomeEdits[m.id]??''} onChange={e=>setIncomeEdits(p=>({...p,[m.id]:e.target.value}))} placeholder="—"
                        className="w-28 px-2 py-1.5 border border-[var(--border)] rounded-none text-sm text-right focus:outline-none focus:border-[var(--primary)] bg-white" />
                    </td>
                    <td className={'px-4 py-3 text-right text-xs '+(pct>=0.1&&diff!=null?'text-amber-700 font-semibold':'text-green-700')}>
                      {diff!=null?(diff>0?'+':'')+fmtMoney(diff)+' ('+(pct*100).toFixed(1)+'%)':'—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--divider)] bg-[var(--bg-section)]">
                <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-[var(--muted)] uppercase">Totals</td>
                <td className="px-4 py-2 text-right text-sm font-semibold text-[var(--ink)]">{fmtMoney(totalClaimed)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        {(detail.claiming_medical_deduction||detail.has_childcare_expense||detail.dv_status||detail.homeless_at_admission||detail.reasonable_accommodation_requested)&&(
          <div className="px-5 py-3 border-t border-[var(--divider)] flex flex-wrap gap-2">
            {detail.claiming_medical_deduction&&<span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs border border-blue-200">Medical Deduction</span>}
            {detail.has_childcare_expense&&<span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs border border-blue-200">Childcare Expense</span>}
            {detail.dv_status&&<span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs border border-purple-200">DV Status</span>}
            {detail.homeless_at_admission&&<span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs border border-orange-200">Homeless at Admission</span>}
            {detail.reasonable_accommodation_requested&&<span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-xs border border-teal-200">Reasonable Accommodation</span>}
          </div>
        )}
      </section>

      {/* Unified Review Surface - Documents */}
      <StantonReviewSurface
        application={detail}
        documents={detail.documents}
        workspaceId={detail.id}
        anchorType={ANCHOR_TYPE}
        anchorId={detail.id}
        onDocumentAction={handleDocumentAction}
        showIntakeButton={true}
      />

      <section className="bg-white border border-[var(--border)]">
        <div className="px-5 py-3 border-b border-[var(--divider)]">
          <h2 className="text-sm font-semibold text-[var(--primary)] uppercase tracking-wide">Stanton Review</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--ink)] mb-1">Review Status</label>
              <select value={reviewStatus} onChange={e=>setReviewStatus(e.target.value)}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white">
                {Object.entries(STATUS_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--ink)] mb-1">Reviewer</label>
              <input type="text" value={reviewerName} onChange={e=>setReviewerName(e.target.value)} placeholder="Staff name"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--ink)] mb-1">Review Notes</label>
            <textarea value={reviewNotes} onChange={e=>setReviewNotes(e.target.value)} rows={3} placeholder="Internal notes..."
              className="w-full px-3 py-2 border border-[var(--border)] rounded-none text-sm focus:outline-none focus:border-[var(--primary)] bg-white resize-none" />
          </div>
          {detail.stanton_review_date&&<p className="text-xs text-[var(--muted)]">Last reviewed {fmtDate(detail.stanton_review_date)}{detail.stanton_reviewer?' by '+detail.stanton_reviewer:''}</p>}
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleSave} disabled={saving}
              className="px-5 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
              {saving?'Saving...':'Save Review'}
            </button>
            {saveMsg&&<span className="text-xs text-[var(--muted)]">{saveMsg}</span>}
          </div>
        </div>
      </section>

      <section className="bg-white border border-[var(--border)]">
        <div className="px-5 py-3 border-b border-[var(--divider)]">
          <h2 className="text-sm font-semibold text-[var(--primary)] uppercase tracking-wide">Actions</h2>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap gap-3 items-start">
            <div className="space-y-1">
              <button type="button" onClick={handleGenerateHha} disabled={!canGenerateHha||generatingHha}
                className="px-5 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
                {generatingHha?'Generating...':'Generate HHA Application'}
              </button>
              {hhaBlockReason&&<p className="text-xs text-amber-700">{hhaBlockReason}</p>}
              {detail.hha_application_file&&<p className="text-xs text-green-700">HHA previously generated.</p>}
              {hhaMsg&&<p className="text-xs text-[var(--muted)]">{hhaMsg}</p>}
            </div>
            <button type="button" onClick={handleExportHach} disabled={exportingHach}
              className="px-5 py-2 border border-[var(--border)] text-[var(--ink)] text-sm font-medium hover:bg-[var(--bg-section)] transition-colors disabled:opacity-50">
              {exportingHach?'Exporting...':'Download HACH Package'}
            </button>

            {sendToHachPermission && !detail.packet_locked && (
              <button type="button" onClick={()=>setShowSendToHach(true)}
                className="px-5 py-2 bg-indigo-700 text-white text-sm font-medium hover:opacity-90 transition-opacity">
                Send to HACH
              </button>
            )}
            {sendToHachPermission && detail.packet_locked && (
              <button type="button" onClick={()=>setShowReopen(true)}
                className="px-5 py-2 border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50 transition-colors">
                Reopen Packet
              </button>
            )}
            
            {/* Signing Packet Link - only show after HACH approval */}
            {detail.hach_review_status === 'approved_by_hach' && (
              <Link href={`/admin/pbv/full-applications/${id}/signing`}
                className="px-5 py-2 bg-purple-700 text-white text-sm font-medium hover:opacity-90 transition-opacity inline-block">
                Signing Packet
              </Link>
            )}
            {!sendToHachPermission && (
              <p className="text-xs text-[var(--muted)] self-center">
                Send to HACH requires elevated permissions.
              </p>
            )}
          </div>
          <div className="pt-2 border-t border-[var(--divider)]">
            <p className="text-xs text-[var(--muted)] mb-1 font-medium">Tenant Magic Link</p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[var(--muted)] truncate">{detail.magic_link}</span>
              <button type="button"
                onClick={()=>{navigator.clipboard.writeText(detail.magic_link);setLinkCopied(true);setTimeout(()=>setLinkCopied(false),2000);}}
                className="text-xs text-[var(--muted)] hover:text-[var(--ink)] underline whitespace-nowrap">
                {linkCopied?'Copied!':'Copy'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white border border-[var(--border)]">
        <div className="px-5 py-3 border-b border-[var(--divider)]">
          <h2 className="text-sm font-semibold text-[var(--primary)] uppercase tracking-wide">Household Members</h2>
        </div>
        <div className="divide-y divide-[var(--divider)]">
          {detail.members.map(m=>(
            <div key={m.id} className="px-5 py-4 space-y-1">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium text-[var(--ink)]">{m.name}</span>
                  <span className="text-xs text-[var(--muted)] ml-2">{m.relationship} · {m.age??'?'} yr</span>
                </div>
                <div className="flex gap-2 text-xs">
                  {m.disability&&<span className="px-1.5 py-0.5 bg-gray-100 text-gray-600">Disability</span>}
                  {m.student&&<span className="px-1.5 py-0.5 bg-gray-100 text-gray-600">Student</span>}
                  {m.signature_required&&(m.signed_forms.length>0?<span className="px-1.5 py-0.5 bg-green-100 text-green-700">Signed</span>:<span className="px-1.5 py-0.5 bg-amber-100 text-amber-700">Sig. Pending</span>)}
                </div>
              </div>
              <div className="text-xs text-[var(--muted)] flex flex-wrap gap-4">
                <span>Citizenship: {m.citizenship_status}</span>
                {m.ssn_last_four&&<span>SSN: lastfour {m.ssn_last_four}</span>}
                {m.income_sources?.length>0&&<span>Income: {m.income_sources.join(', ')}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {showSendToHach && (
        <SendToHachDialog
          applicationId={detail.id}
          onClose={()=>setShowSendToHach(false)}
          onSuccess={()=>{ setShowSendToHach(false); fetchDetail(); }}
        />
      )}

      {showReopen && (
        <ReopenPacketDialog
          applicationId={detail.id}
          onClose={()=>setShowReopen(false)}
          onSuccess={()=>{ setShowReopen(false); fetchDetail(); }}
        />
      )}
    </div>
  );
}
