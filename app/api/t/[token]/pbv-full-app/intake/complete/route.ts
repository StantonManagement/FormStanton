/**
 * POST /api/t/[token]/pbv-full-app/intake/complete
 *
 * Marks intake_status = 'complete' and sets intake_completed_at.
 * Validates that the required sections are present in intake_data.
 * Bridges intake_data -> pbv_household_members and seeds application_documents.
 * Idempotent: if already complete, returns 200 with existing timestamp.
 *
 * Does NOT trigger form generation — that is a separate explicit call.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';
import { ALWAYS_SECTIONS, type IntakeData } from '@/lib/pbv/intake-schema';
import { getApplicableMembers } from '@/lib/memberFilter';
import { persistDocumentTriggers } from '@/lib/pbv/applyDocumentTriggers';
import { sendTenantNotification } from '@/lib/notifications/send';
import { buildPreflightDocList } from '@/lib/notifications/buildPreflightDocList';
import { NotificationType } from '@/lib/notifications/types';

const REQUIRED_SECTIONS: string[] = ALWAYS_SECTIONS;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  return withTenantContext(request, token, 'intake-complete', async (app) => {
    const { data: current, error: readError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, intake_data, intake_status, intake_completed_at, preferred_language, submission_language')
      .eq('id', app.id)
      .maybeSingle();

    if (readError) throw readError;

    // Idempotent replay
    if (current?.intake_status === 'complete' && current?.intake_completed_at) {
      return {
        body: {
          success: true,
          data: { intake_status: 'complete', intake_completed_at: current.intake_completed_at },
        },
        status: 200,
      };
    }

    // Validate required sections are present
    const intakeData = (current?.intake_data as IntakeData) ?? {};
    const intakeDataRecord = (current?.intake_data as Record<string, unknown>) ?? {};
    const missingSections = REQUIRED_SECTIONS.filter((s) => !intakeDataRecord[s]);

    if (missingSections.length > 0) {
      return {
        body: {
          success: false,
          message: 'Required intake sections are incomplete',
          missing_sections: missingSections,
        },
        status: 422,
      };
    }

    const completedAt = new Date().toISOString();

    // F2: Bridge intake_data to pbv_household_members + seed application_documents
    try {
      await bridgeIntakeToDatabase(app.id, intakeData, current?.preferred_language ?? current?.submission_language ?? 'en');
    } catch (bridgeError: any) {
      console.error('[intake/complete] Bridge failed:', bridgeError);
      return {
        body: {
          success: false,
          message: bridgeError.message || 'Failed to process household data. Please try again.',
        },
        status: 500,
      };
    }

    // F1: Send pre-flight checklist SMS (non-blocking)
    try {
      const language = (current?.preferred_language ?? current?.submission_language ?? 'en') as 'en' | 'es' | 'pt';
      const docList = await buildPreflightDocList(app.id, language);
      
      // Extract tenant name from head_of_household_name or fallback
      const tenantName: string = (app.head_of_household_name as string | null | undefined) ?? 'there';
      
      // Generate magic link using existing token
      const magicLink = `${process.env.NEXT_PUBLIC_APP_URL}/t/${token}`;
      
      // Generate unique event ID for idempotency
      const bridgeEventId = `intake-complete-${app.id}-${completedAt}`;
      
      await sendTenantNotification({
        applicationId: app.id,
        notificationType: NotificationType.PBV_PREFLIGHT_CHECKLIST,
        interpolations: {
          tenant_name: tenantName,
          doc_list: docList.docListText,
          magic_link: magicLink,
        },
        triggeredByEventId: bridgeEventId,
      });
      
      console.log(`[intake/complete] Pre-flight checklist sent for application ${app.id}`);
    } catch (notificationError: any) {
      // Don't fail intake completion if notification fails
      console.error('[intake/complete] Pre-flight checklist notification failed (non-fatal):', notificationError);
    }

    // F2: Write immutable snapshot and clear workspace
    const { error: updateError } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({
        intake_status: 'complete',
        intake_completed_at: completedAt,
        intake_snapshot: intakeData,
        intake_snapshot_at: completedAt,
        intake_data: '{}',
        updated_at: completedAt,
      })
      .eq('id', app.id);

    if (updateError) throw updateError;

    return {
      body: {
        success: true,
        data: { intake_status: 'complete', intake_completed_at: completedAt },
      },
      status: 200,
    };
  });
}

function computeAge(dob: string): number | null {
  if (!dob) return null;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

async function bridgeIntakeToDatabase(
  appId: string,
  intakeData: IntakeData,
  preferredLang: string
): Promise<void> {
  const household = intakeData.household;
  if (!household || !household.members || household.members.length === 0) {
    throw new Error('Household data is missing or has no members');
  }

  const members = household.members;
  const incomeByMember = intakeData.income?.by_member ?? [];
  const criminalByMember = intakeData.criminal_history?.by_member ?? [];
  const contact = intakeData.contact;
  const dvHomeless = intakeData.dv_homeless_ra;
  const childcare = intakeData.childcare_disability;

  const memberRows: object[] = [];
  const memberDataForFormData: object[] = [];

  for (let i = 0; i < members.length; i++) {
    const m = members[i];
    const slot = i + 1;
    const age = computeAge(m.dob);
    const signatureRequired = age !== null && age >= 18;

    const memberIncome = incomeByMember.find((inc) => inc.member_slot === slot);
    const incomeSources: string[] = [];
    if (memberIncome?.income_sources) {
      for (const src of memberIncome.income_sources) {
        if (src.has_income && src.type) {
          incomeSources.push(src.type);
        }
      }
    }

    // Compute annual income from monthly amounts (intake collects monthly, bridge stores annual)
    const annualIncome = (memberIncome?.income_sources ?? [])
      .filter(src => src.has_income && typeof src.amount_monthly === 'number')
      .reduce((sum, src) => sum + ((src.amount_monthly as number) * 12), 0);

    const employed = incomeSources.includes('employment');
    const hasSsi = incomeSources.includes('ssi');
    const hasSs = incomeSources.includes('ss');
    const hasPension = incomeSources.includes('pension');
    const hasTanf = incomeSources.includes('tanf');
    const hasChildSupport = incomeSources.includes('child_support');
    const hasUnemployment = incomeSources.includes('unemployment');
    const hasSelfEmployment = incomeSources.includes('self_employment');
    const hasOtherIncome = incomeSources.includes('other');

    const memberCriminal = criminalByMember.find((c) => c.member_slot === slot);
    const criminalHistory = memberCriminal?.has_criminal_history ?? null;

    // Full SSN comes from the encrypted vault (intake_data.ssn_vault[slot]),
    // never from the household payload (which only ever carries last-4). Fall
    // back to the last-4 the applicant typed if no vault entry exists.
    let ssnEncrypted: string | null = null;
    let ssnLast4: string | null = null;
    const vaultEntry = intakeData.ssn_vault?.[String(slot)];
    if (vaultEntry?.enc) {
      ssnEncrypted = vaultEntry.enc;
      ssnLast4 = vaultEntry.last4 ? vaultEntry.last4.replace(/\D/g, '').slice(-4) : null;
    } else if (vaultEntry?.last4) {
      ssnLast4 = vaultEntry.last4.replace(/\D/g, '').slice(-4);
    } else if (m.ssn_last_four && m.ssn_last_four.length >= 4) {
      ssnLast4 = m.ssn_last_four.replace(/\D/g, '').slice(-4);
    }

    memberRows.push({
      full_application_id: appId,
      slot,
      name: m.name.trim(),
      date_of_birth: m.dob,
      age,
      relationship: i === 0 ? 'head' : (m.relationship || 'other'),
      ssn_encrypted: ssnEncrypted,
      ssn_last_four: ssnLast4,
      annual_income: annualIncome,
      income_sources: incomeSources,
      employed,
      has_ssi: hasSsi,
      has_ss: hasSs,
      has_pension: hasPension,
      has_tanf: hasTanf,
      has_child_support: hasChildSupport,
      has_unemployment: hasUnemployment,
      has_self_employment: hasSelfEmployment,
      has_other_income: hasOtherIncome,
      disability: m.disability === true,
      student: m.student === true,
      citizenship_status: m.citizenship_status || 'not_reported',
      criminal_history: criminalHistory,
      signature_required: signatureRequired,
      created_by: 'tenant',
    });

    memberDataForFormData.push({
      slot,
      age,
      employed,
      has_ssi: hasSsi,
      has_ss: hasSs,
      has_pension: hasPension,
      has_tanf: hasTanf,
      has_child_support: hasChildSupport,
      has_unemployment: hasUnemployment,
      has_self_employment: hasSelfEmployment,
      has_other_income: hasOtherIncome,
      citizenship_status: m.citizenship_status || 'not_reported',
    });
  }

  const totalAnnualIncome = memberRows.reduce((sum: number, m: any) => sum + (m.annual_income || 0), 0);
  const hohName = members[0]?.name || '';
  const phone = contact?.phone_cell || contact?.phone_home || contact?.phone_work || null;
  const validLang = ['en', 'es', 'pt'].includes(preferredLang) ? preferredLang : 'en';

  const { error: deleteMembersError } = await supabaseAdmin
    .from('pbv_household_members')
    .delete()
    .eq('full_application_id', appId);

  if (deleteMembersError) throw deleteMembersError;

  const { error: insertMembersError } = await supabaseAdmin
    .from('pbv_household_members')
    .insert(memberRows);

  if (insertMembersError) {
    throw new Error('Failed to insert household members: ' + insertMembersError.message);
  }

  const { error: updateAppError } = await supabaseAdmin
    .from('pbv_full_applications')
    .update({
      head_of_household_name: hohName.trim(),
      household_size: members.length,
      total_annual_income: totalAnnualIncome,
      dv_status: dvHomeless?.dv_status === true,
      homeless_at_admission: dvHomeless?.homeless_at_admission === true,
      claiming_medical_deduction: false,
      has_childcare_expense: childcare?.has_care4kids === true || (childcare?.childcare_monthly_amount ?? 0) > 0,
      reasonable_accommodation_requested: dvHomeless?.reasonable_accommodation_requested === true,
      phone: phone ? phone.trim() : null,
      preferred_language: validLang,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appId);

  if (updateAppError) {
    await supabaseAdmin.from('pbv_household_members').delete().eq('full_application_id', appId);
    throw new Error('Failed to update application: ' + updateAppError.message);
  }

  try {
    await seedApplicationDocuments(appId, memberDataForFormData, {
      dv_status: dvHomeless?.dv_status === true,
      reasonable_accommodation_requested: dvHomeless?.reasonable_accommodation_requested === true,
    });
  } catch (seedError: any) {
    await supabaseAdmin.from('pbv_household_members').delete().eq('full_application_id', appId);
    throw new Error('Failed to seed documents: ' + seedError.message);
  }

  // F4: Apply intake-based document triggers — mark docs whose conditions
  // are no longer met as 'no_longer_required'. Non-blocking: log only.
  const triggerResult = await persistDocumentTriggers(appId, intakeData);
  if (triggerResult.error) {
    console.error('[intake/complete] Document trigger apply failed (non-fatal):', triggerResult.error);
  } else {
    console.log(`[intake/complete] Document triggers: ${triggerResult.deactivated} deactivated, ${triggerResult.activated} activated`);
  }
}

async function seedApplicationDocuments(
  appId: string,
  memberDataForFormData: object[],
  flags: { dv_status: boolean; reasonable_accommodation_requested: boolean }
): Promise<void> {
  const anyMemberHasChildSupport = memberDataForFormData.some(
    (m: any) => m.has_child_support === true
  );

  const { data: templates, error: templatesError } = await supabaseAdmin
    .from('form_document_templates')
    .select('*')
    .eq('form_id', 'pbv-full-application')
    .order('display_order', { ascending: true });

  if (templatesError) throw templatesError;
  if (!templates || templates.length === 0) {
    throw new Error('No document templates found for pbv-full-application');
  }

  const { error: deleteError } = await supabaseAdmin
    .from('application_documents')
    .delete()
    .eq('anchor_type', 'pbv_full_application')
    .eq('anchor_id', appId);

  if (deleteError) throw deleteError;

  const docRows: object[] = [];
  for (const template of templates) {
    if (template.doc_type === 'vawa_certification' && !flags.dv_status) continue;
    if (template.doc_type === 'reasonable_accommodation_request' && !flags.reasonable_accommodation_requested) continue;
    if (template.doc_type === 'child_support_affidavit' && !anyMemberHasChildSupport) continue;
    if (template.doc_type === 'no_child_support_affidavit' && anyMemberHasChildSupport) continue;

    if (!template.per_person || template.applies_to === 'submission') {
      docRows.push({
        anchor_type: 'pbv_full_application',
        anchor_id: appId,
        doc_type: template.doc_type,
        label: template.label,
        required: template.required,
        requires_signature: template.requires_signature === true,
        signer_scope: template.signer_scope ?? null,
        display_order: template.display_order,
        person_slot: 0,
        status: 'missing',
        created_by: 'system',
        category: template.category,
      });
    } else {
      const matched = getApplicableMembers(
        memberDataForFormData as any[],
        template.applies_to,
        template.member_filter
      );
      const slots = matched.length > 0 ? matched.map(({ slot }) => slot) : [0];
      for (const slot of slots) {
        docRows.push({
          anchor_type: 'pbv_full_application',
          anchor_id: appId,
          doc_type: template.doc_type,
          label: template.label,
          required: template.required,
          requires_signature: template.requires_signature === true,
          signer_scope: template.signer_scope ?? null,
          display_order: template.display_order,
          person_slot: slot,
          status: 'missing',
          created_by: 'system',
          category: template.category,
        });
      }
    }
  }

  if (docRows.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from('application_documents')
      .insert(docRows);

    if (insertError) throw insertError;
  }
}
