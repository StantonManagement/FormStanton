/**
 * lib/notifications/buildPreflightDocList.ts
 *
 * Builds the pre-flight checklist document list for SMS.
 * Queries the filtered doc list for an application and maps each doc type
 * to a plain-language one-liner using docTypeHelp content.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { getDocHelp } from '@/lib/pbv/docTypeHelp';
import { filterByTriggers } from '@/lib/pbv/applyDocumentTriggers';
import type { IntakeData } from '@/lib/pbv/intake-schema';

export interface PreflightDocListResult {
  docListText: string;
  fallbackUsed: boolean;
}

/**
 * Build a pre-flight document list for SMS.
 * 
 * @param applicationId - The PBV application ID
 * @param language - Language code ('en' | 'es' | 'pt')
 * @returns Object with doc list text and whether fallback was used
 */
export async function buildPreflightDocList(
  applicationId: string,
  language: 'en' | 'es' | 'pt'
): Promise<PreflightDocListResult> {
  try {
    // 1. Get application and intake snapshot
    const { data: application, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('intake_snapshot')
      .eq('id', applicationId)
      .single();

    if (appError || !application) {
      console.error(`[buildPreflightDocList] Failed to fetch application ${applicationId}:`, appError);
      return {
        docListText: "We'll show you the list in your application.",
        fallbackUsed: true,
      };
    }

    const intakeData = application.intake_snapshot as IntakeData;
    if (!intakeData) {
      console.error(`[buildPreflightDocList] No intake snapshot for application ${applicationId}`);
      return {
        docListText: "We'll show you the list in your application.",
        fallbackUsed: true,
      };
    }

    // 2. Get all document templates for this application
    const { data: docs, error: docsError } = await supabaseAdmin
      .from('application_documents')
      .select('id, doc_type, status, required, category')
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', applicationId)
      .order('display_order', { ascending: true });

    if (docsError || !docs) {
      console.error(`[buildPreflightDocList] Failed to fetch documents for ${applicationId}:`, docsError);
      return {
        docListText: "We'll show you the list in your application.",
        fallbackUsed: true,
      };
    }

    // 3. Apply triggers to filter out de-triggered docs
    const filteredDocs = filterByTriggers(docs, intakeData);
    
    // 4. Group and format the document list
    const docListItems: string[] = [];
    const signedFormsDocTypes = [
      'main_application',
      'criminal_background_release', 
      'child_support_affidavit',
      'no_child_support_affidavit',
      'hud_9886a',
      'hach_release',
      'obligations_of_family',
      'briefing_docs_certification',
      'debts_owed_phas',
      'citizenship_declaration',
      'eiv_guide_receipt',
      'hud_92006',
      'vawa_certification',
      'reasonable_accommodation_request'
    ];

    // Track if we have any signed forms to group them
    let hasSignedForms = false;
    const otherDocs: string[] = [];

    for (const doc of filteredDocs) {
      // Skip docs that are no longer required
      if (doc.status === 'no_longer_required') continue;
      
      // Skip optional docs - only show required ones for pre-flight
      if (!doc.required) continue;

      if (signedFormsDocTypes.includes(doc.doc_type)) {
        hasSignedForms = true;
      } else {
        // Get one-liner help text for this doc type
        const helpText = getDocHelp(doc.doc_type, language);
        
        // Create a concise one-liner from the help text
        const oneLiner = createOneLiner(helpText, doc.doc_type);
        otherDocs.push(oneLiner);
      }
    }

    // Add other docs first
    docListItems.push(...otherDocs);

    // Add signed forms as one bullet if any exist
    if (hasSignedForms) {
      docListItems.push("Stanton's forms to sign — we'll generate these for you");
    }

    // If no docs at all, provide fallback
    if (docListItems.length === 0) {
      return {
        docListText: "We'll show you the list in your application.",
        fallbackUsed: true,
      };
    }

    // Join with checkmarks and newlines
    const docListText = docListItems.map(item => `✓ ${item}`).join('\n');

    return {
      docListText,
      fallbackUsed: false,
    };

  } catch (error) {
    console.error(`[buildPreflightDocList] Unexpected error for ${applicationId}:`, error);
    return {
      docListText: "We'll show you the list in your application.",
      fallbackUsed: true,
    };
  }
}

/**
 * Create a concise one-liner from help text.
 * Falls back to doc_type if help text is missing.
 */
function createOneLiner(helpText: string, docType: string): string {
  if (!helpText) {
    // Fallback to formatted doc type
    return docType.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  // Take first sentence or first 60 chars, whichever is shorter
  const firstSentence = helpText.split('.')[0];
  const cleaned = firstSentence.replace(/\s+/g, ' ').trim();
  
  if (cleaned.length <= 60) {
    return cleaned;
  }
  
  // Truncate at word boundary
  const truncated = cleaned.substring(0, 60).replace(/\s+\S*$/, '');
  return truncated + '...';
}
