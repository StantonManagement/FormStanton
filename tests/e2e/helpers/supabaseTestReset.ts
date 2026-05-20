import { supabaseTestClient } from './supabaseTestClient';

/**
 * Cleans up test data created by the test harness.
 * Call this after test runs to keep the test database clean.
 */
export async function cleanupTestData(applicationId: string): Promise<void> {
  // Delete in dependency order

  // 1. Delete application_document_revisions (child of application_documents)
  const { data: docs } = await supabaseTestClient
    .from('application_documents')
    .select('id')
    .eq('anchor_type', 'pbv_full_application')
    .eq('anchor_id', applicationId);

  if (docs && docs.length > 0) {
    const docIds = docs.map(d => d.id);
    await supabaseTestClient
      .from('application_document_revisions')
      .delete()
      .in('application_document_id', docIds);

    // 2. Delete application_documents
    await supabaseTestClient
      .from('application_documents')
      .delete()
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', applicationId);
  }

  // 3. Delete application_events
  await supabaseTestClient
    .from('application_events')
    .delete()
    .eq('application_id', applicationId);

  // 4. Delete signatures
  await supabaseTestClient
    .from('signatures')
    .delete()
    .eq('anchor_type', 'pbv_full_application')
    .eq('anchor_id', applicationId);

  // 5a. Delete pbv_signature_events (child of pbv_form_documents)
  const { data: formDocs } = await supabaseTestClient
    .from('pbv_form_documents')
    .select('id')
    .eq('full_application_id', applicationId);

  if (formDocs && formDocs.length > 0) {
    const formDocIds = formDocs.map((d) => d.id);
    await supabaseTestClient
      .from('pbv_signature_events')
      .delete()
      .in('form_document_id', formDocIds);

    await supabaseTestClient
      .from('pbv_form_documents')
      .delete()
      .in('id', formDocIds);
  }

  // 5b. Delete pbv_summary_documents
  await supabaseTestClient
    .from('pbv_summary_documents')
    .delete()
    .eq('full_application_id', applicationId);

  // 5. Delete pbv_household_members
  await supabaseTestClient
    .from('pbv_household_members')
    .delete()
    .eq('full_application_id', applicationId);

  // 6. Get form_submission_id before deleting app
  const { data: app } = await supabaseTestClient
    .from('pbv_full_applications')
    .select('form_submission_id')
    .eq('id', applicationId)
    .single();

  // 7. Delete pbv_full_applications
  await supabaseTestClient
    .from('pbv_full_applications')
    .delete()
    .eq('id', applicationId);

  // 8. Delete form_submissions
  if (app?.form_submission_id) {
    await supabaseTestClient
      .from('form_submissions')
      .delete()
      .eq('id', app.form_submission_id);
  }
}

/**
 * Identifies and cleans up orphaned test data older than a threshold.
 * Useful for periodic cleanup of test databases.
 */
export async function cleanupOldTestData(maxAgeMinutes: number = 60): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();

  // Find old test applications
  const { data: oldApps } = await supabaseTestClient
    .from('pbv_full_applications')
    .select('id')
    .like('tenant_access_token', 'test-app-%')
    .lt('created_at', cutoff);

  if (!oldApps || oldApps.length === 0) {
    return 0;
  }

  // Clean up each old application
  for (const app of oldApps) {
    await cleanupTestData(app.id);
  }

  return oldApps.length;
}

/**
 * Test hook to be used in test files for automatic cleanup.
 */
export function useTestCleanup(applicationId: string) {
  return async () => {
    await cleanupTestData(applicationId);
  };
}
