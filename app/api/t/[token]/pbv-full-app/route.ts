import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { encryptSsn, ssnLastFour } from '@/lib/ssnEncryption';
import { getApplicableMembers } from '@/lib/memberFilter';

function computeAge(dob: string): number | null {
  if (!dob) return null;
  const dobDate = new Date(dob);
  if (isNaN(dobDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dobDate.getFullYear();
  const m = today.getMonth() - dobDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
    age--;
  }
  return age;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, building_address, unit_number, preapp_id, form_submission_id')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError) throw appError;

    if (!app) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }

    // Check if intake already submitted (household members exist)
    const { count } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id', { count: 'exact', head: true })
      .eq('full_application_id', app.id);

    const intake_submitted = (count ?? 0) > 0;

    // Language hint from linked pre-application
    let preferred_language = 'en';
    if (app.preapp_id) {
      const { data: preapp } = await supabaseAdmin
        .from('pbv_preapplications')
        .select('language')
        .eq('id', app.preapp_id)
        .maybeSingle();
      if (preapp?.language) preferred_language = preapp.language;
    }

    // Document portal token + summary (form_submissions)
    let form_submission_token: string | null = null;
    let document_summary: Record<string, number> | null = null;
    if (app.form_submission_id) {
      const { data: sub } = await supabaseAdmin
        .from('form_submissions')
        .select('tenant_access_token, document_review_summary')
        .eq('id', app.form_submission_id)
        .maybeSingle();
      form_submission_token = sub?.tenant_access_token ?? null;
      document_summary = (sub?.document_review_summary as Record<string, number> | null) ?? null;
    }

    const signature_progress: Array<{
      member_id: string;
      slot: number;
      name: string;
      required_doc_count: number;
      signed_doc_count: number;
    }> = [];

    // Signatures complete check — all required signature docs are signed/submitted per signer scope
    let signatures_complete = false;
    if (intake_submitted && app.form_submission_id) {
      const { data: sigMembers } = await supabaseAdmin
        .from('pbv_household_members')
        .select('id, slot, name, signature_required')
        .eq('full_application_id', app.id)
        .eq('signature_required', true);

      const { data: signatureDocs } = await supabaseAdmin
        .from('form_submission_documents')
        .select('id, person_slot, signer_scope, status, requires_signature')
        .eq('form_submission_id', app.form_submission_id)
        .eq('requires_signature', true);

      const isSignedStatus = (status: string): boolean =>
        status === 'submitted' || status === 'approved' || status === 'waived';

      const docsForMember = (slot: number) =>
        (signatureDocs ?? []).filter((doc) => {
          if (doc.signer_scope === 'all_adults') {
            return doc.person_slot === slot;
          }
          if (doc.signer_scope === 'hoh_only') {
            return slot === 1 && doc.person_slot === 0;
          }
          if (doc.signer_scope === 'individual') {
            return doc.person_slot === slot || (slot === 1 && doc.person_slot === 0);
          }
          return doc.person_slot === slot;
        });

      if (sigMembers && sigMembers.length > 0) {
        for (const member of sigMembers) {
          const requiredDocs = docsForMember(member.slot);
          const signedCount = requiredDocs.filter((d) => isSignedStatus(d.status)).length;

          signature_progress.push({
            member_id: member.id,
            slot: member.slot,
            name: member.name,
            required_doc_count: requiredDocs.length,
            signed_doc_count: signedCount,
          });
        }

        signatures_complete = signature_progress.every(
          (m) => m.required_doc_count === 0 || m.signed_doc_count >= m.required_doc_count
        );
      } else {
        signatures_complete = true;
      }
    }

    const next_step = !intake_submitted
      ? 'intake'
      : !signatures_complete
      ? 'signatures'
      : ((document_summary?.missing ?? 0) + (document_summary?.rejected ?? 0) > 0)
      ? 'documents'
      : 'complete';

    return NextResponse.json({
      success: true,
      data: {
        building_address: app.building_address,
        unit_number: app.unit_number,
        preferred_language,
        intake_submitted,
        signatures_complete,
        form_submission_token,
        signature_progress,
        document_summary,
        next_step,
      },
    });
  } catch (error: any) {
    console.error('PBV full-app GET error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, building_address, unit_number, form_submission_id')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError) throw appError;

    if (!app) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }

    // Duplicate submission guard
    const { count: existingCount } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id', { count: 'exact', head: true })
      .eq('full_application_id', app.id);

    if ((existingCount ?? 0) > 0) {
      return NextResponse.json(
        { success: false, message: 'Application intake already submitted' },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
    }

    const {
      hoh_name,
      hoh_dob,
      household_members,
      has_insurance_settlement = false,
      has_cd_trust_bond = false,
      has_life_insurance = false,
      claiming_medical_deduction = false,
      has_childcare_expense = false,
      dv_status = false,
      homeless_at_admission = false,
      reasonable_accommodation_requested = false,
    } = body;

    if (!hoh_name?.trim()) {
      return NextResponse.json(
        { success: false, message: 'Head of household name is required' },
        { status: 400 }
      );
    }
    if (!hoh_dob) {
      return NextResponse.json(
        { success: false, message: 'Head of household date of birth is required' },
        { status: 400 }
      );
    }
    if (!Array.isArray(household_members) || household_members.length === 0) {
      return NextResponse.json(
        { success: false, message: 'At least one household member is required' },
        { status: 400 }
      );
    }

    for (let i = 0; i < household_members.length; i++) {
      const m = household_members[i];
      if (!m.name?.trim()) {
        return NextResponse.json(
          { success: false, message: `Member ${i + 1}: name is required` },
          { status: 400 }
        );
      }
      if (!m.dob) {
        return NextResponse.json(
          { success: false, message: `Member ${i + 1}: date of birth is required` },
          { status: 400 }
        );
      }
      if (i === 0 && !m.relationship) {
        return NextResponse.json(
          { success: false, message: 'Head of household relationship is required' },
          { status: 400 }
        );
      }
      if (i > 0 && !m.relationship) {
        return NextResponse.json(
          { success: false, message: `Member ${i + 1}: relationship is required` },
          { status: 400 }
        );
      }
    }

    // Process and insert household members
    const memberRows: object[] = [];
    const memberDataForFormData: object[] = [];

    for (let i = 0; i < household_members.length; i++) {
      const m = household_members[i];
      const slot = i + 1;
      const age = computeAge(m.dob);
      const signature_required = age !== null && age >= 18;

      // Encrypt SSN if provided (never log the plaintext)
      let ssn_encrypted: string | null = null;
      let ssn_last_four: string | null = null;
      if (m.ssn?.replace(/\D/g, '').length >= 4) {
        try {
          ssn_encrypted = encryptSsn(m.ssn.trim());
          ssn_last_four = ssnLastFour(m.ssn.trim());
        } catch {
          // SSN_ENCRYPTION_KEY not set or malformed — skip encryption
          console.warn(`Member ${slot}: SSN encryption skipped (key not configured)`);
        }
      }

      // Derive boolean income flags from income_sources array
      const sources: string[] = Array.isArray(m.income_sources) ? m.income_sources : [];
      const employed          = sources.includes('employment');
      const has_ssi           = sources.includes('ssi');
      const has_ss            = sources.includes('ss');
      const has_pension       = sources.includes('pension');
      const has_tanf          = sources.includes('tanf');
      const has_child_support = sources.includes('child_support');
      const has_unemployment  = sources.includes('unemployment');
      const has_self_employment = sources.includes('self_employment');
      const has_other_income  = sources.includes('other');

      memberRows.push({
        full_application_id: app.id,
        slot,
        name: m.name.trim(),
        date_of_birth: m.dob,
        age,
        relationship: i === 0 ? 'head' : (m.relationship || 'other'),
        ssn_encrypted,
        ssn_last_four,
        annual_income: typeof m.annual_income === 'number' ? m.annual_income : 0,
        income_sources: sources,
        employed,
        has_ssi,
        has_ss,
        has_pension,
        has_tanf,
        has_child_support,
        has_unemployment,
        has_self_employment,
        has_other_income,
        disability: m.disability === true,
        student: m.student === true,
        citizenship_status: m.citizenship_status || 'not_reported',
        criminal_history: typeof m.criminal_history === 'boolean' ? m.criminal_history : null,
        signature_required,
        created_by: 'tenant',
      });

      // Shape for form_data.household_members — used by memberFilter at Phase 5 seeding
      memberDataForFormData.push({
        slot,
        age,
        employed,
        has_ssi,
        has_ss,
        has_pension,
        has_tanf,
        has_child_support,
        has_unemployment,
        has_self_employment,
        has_other_income,
        citizenship_status: m.citizenship_status || 'not_reported',
      });
    }

    // Insert household members
    const { error: membersError } = await supabaseAdmin
      .from('pbv_household_members')
      .insert(memberRows);

    if (membersError) throw membersError;

    const total_annual_income = (household_members as any[]).reduce(
      (sum: number, m: any) => sum + (typeof m.annual_income === 'number' ? m.annual_income : 0),
      0
    );

    // Update pbv_full_applications with intake summary
    const { error: updateError } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({
        head_of_household_name: hoh_name.trim(),
        household_size: household_members.length,
        total_annual_income,
        dv_status: dv_status === true,
        homeless_at_admission: homeless_at_admission === true,
        claiming_medical_deduction: claiming_medical_deduction === true,
        has_childcare_expense: has_childcare_expense === true,
        reasonable_accommodation_requested: reasonable_accommodation_requested === true,
        intake_submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', app.id);

    if (updateError) throw updateError;

    // Seed form_submission_documents if form_submission_id is set
    if (app.form_submission_id) {
      const anyMemberHasChildSupport = memberDataForFormData.some(
        (m: any) => m.has_child_support === true
      );

      const formData = {
        household_members: memberDataForFormData,
        claiming_medical_deduction: claiming_medical_deduction === true,
        has_childcare_expense: has_childcare_expense === true,
        dv_status: dv_status === true,
        reasonable_accommodation_requested: reasonable_accommodation_requested === true,
        has_insurance_settlement: has_insurance_settlement === true,
        has_cd_trust_bond: has_cd_trust_bond === true,
        has_life_insurance: has_life_insurance === true,
        any_member_has_child_support: anyMemberHasChildSupport,
      };

      // Update form_submissions.form_data
      await supabaseAdmin
        .from('form_submissions')
        .update({ form_data: formData })
        .eq('id', app.form_submission_id);

      // Fetch document templates for pbv-full-application
      const { data: templates } = await supabaseAdmin
        .from('form_document_templates')
        .select('*')
        .eq('form_id', 'pbv-full-application')
        .order('display_order', { ascending: true });

      if (templates && templates.length > 0) {
        // Remove any previously seeded document slots
        await supabaseAdmin
          .from('form_submission_documents')
          .delete()
          .eq('form_submission_id', app.form_submission_id);

        // Build correct document slot rows
        const docRows: object[] = [];
        for (const template of templates) {
          if (template.doc_type === 'vawa_certification' && dv_status !== true) {
            continue;
          }
          if (
            template.doc_type === 'reasonable_accommodation_request' &&
            reasonable_accommodation_requested !== true
          ) {
            continue;
          }
          if (template.doc_type === 'child_support_affidavit' && !anyMemberHasChildSupport) {
            continue;
          }
          if (template.doc_type === 'no_child_support_affidavit' && anyMemberHasChildSupport) {
            continue;
          }

          if (!template.per_person || template.applies_to === 'submission') {
            docRows.push({
              form_submission_id: app.form_submission_id,
              doc_type: template.doc_type,
              label: template.label,
              required: template.required,
              requires_signature: template.requires_signature === true,
              signer_scope: template.signer_scope ?? null,
              display_order: template.display_order,
              person_slot: 0,
              status: 'missing',
              created_by: 'system',
            });
          } else {
            const matched = getApplicableMembers(
              memberDataForFormData as any[],
              template.applies_to,
              template.member_filter
            );
            if (matched.length === 0) {
              docRows.push({
                form_submission_id: app.form_submission_id,
                doc_type: template.doc_type,
                label: template.label,
                required: template.required,
                requires_signature: template.requires_signature === true,
                signer_scope: template.signer_scope ?? null,
                display_order: template.display_order,
                person_slot: 0,
                status: 'missing',
                created_by: 'system',
              });
            } else {
              for (const { slot } of matched) {
                docRows.push({
                  form_submission_id: app.form_submission_id,
                  doc_type: template.doc_type,
                  label: template.label,
                  required: template.required,
                  requires_signature: template.requires_signature === true,
                  signer_scope: template.signer_scope ?? null,
                  display_order: template.display_order,
                  person_slot: slot,
                  status: 'missing',
                  created_by: 'system',
                });
              }
            }
          }
        }

        if (docRows.length > 0) {
          await supabaseAdmin.from('form_submission_documents').insert(docRows);
        }

        // Update document_review_summary
        await supabaseAdmin
          .from('form_submissions')
          .update({
            document_review_summary: {
              total: docRows.length,
              missing: docRows.length,
              submitted: 0,
              approved: 0,
              rejected: 0,
              waived: 0,
            },
          })
          .eq('id', app.form_submission_id);
      }
    }

    return NextResponse.json({ success: true, data: { id: app.id } });
  } catch (error: any) {
    console.error('PBV full-app POST error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
