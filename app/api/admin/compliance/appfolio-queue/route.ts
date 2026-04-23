import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { normalizeAddress } from '@/lib/addressNormalizer';
import { buildingToPortfolio } from '@/lib/portfolios';

/**
 * Returns aggregate counts + detail lists for the AppFolio entry queues.
 * Optional filters:
 *   - ?building=<address>
 *   - ?portfolio=<portfolio_name>
 */
export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const buildingParam = request.nextUrl.searchParams.get('building');
    const portfolioParam = request.nextUrl.searchParams.get('portfolio');
    const normalizedBuilding = buildingParam ? normalizeAddress(buildingParam) : null;

    // --- Fetch all non-merged submissions ---
    const { data: allSubs, error: subsErr } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .is('merged_into', null);

    if (subsErr) {
      console.error('appfolio-queue: submissions error', subsErr);
      return NextResponse.json({ success: false, message: 'Failed to fetch submissions' }, { status: 500 });
    }

    // --- Apply building / portfolio filter ---
    let subs = allSubs || [];
    if (normalizedBuilding) {
      subs = subs.filter(s => normalizeAddress(s.building_address || '') === normalizedBuilding);
    } else if (portfolioParam) {
      subs = subs.filter(s => buildingToPortfolio[s.building_address || ''] === portfolioParam);
    }

    // --- Fetch current tenant lookup (for move-out auto-flag) ---
    const { data: tenants } = await supabaseAdmin
      .from('tenant_lookup')
      .select('name, first_name, last_name, unit_number, building_address, is_current');

    // Build map: `${normalizedBuilding}|${unit}` → current tenant name (only is_current=true)
    const currentTenantMap = new Map<string, string>();
    for (const t of tenants || []) {
      if (!t.is_current) continue;
      const name = (t.name && t.name !== 'Occupied Unit')
        ? t.name
        : `${t.first_name || ''} ${t.last_name || ''}`.trim();
      if (!name) continue;
      const nb = normalizeAddress(t.building_address || '');
      const key = `${nb}|${t.unit_number}`;
      currentTenantMap.set(key, name);
    }

    // Helper to build a compact row for the queue lists
    const toRow = (s: any) => ({
      submission_id: s.id,
      full_name: s.full_name,
      unit_number: s.unit_number,
      building_address: s.building_address,
      phone: s.phone,
      email: s.email,
      has_vehicle: s.has_vehicle,
      has_pets: s.has_pets,
      permit_issued: s.permit_issued,
      permit_issued_at: s.permit_issued_at,
      tenant_picked_up: s.tenant_picked_up,
      tenant_picked_up_at: s.tenant_picked_up_at,
      permit_entered_in_appfolio: s.permit_entered_in_appfolio,
      pickup_id_photo: s.pickup_id_photo,
      pickup_id_uploaded_to_appfolio: s.pickup_id_uploaded_to_appfolio,
      pet_verified: s.pet_verified,
      pet_fee_added_to_appfolio: s.pet_fee_added_to_appfolio,
      permit_fee_added_to_appfolio: s.permit_fee_added_to_appfolio,
      pet_fee_amount: s.pet_fee_amount,
      permit_fee_amount: s.permit_fee_amount,
      has_fee_exemption: s.has_fee_exemption,
      permit_revoked: s.permit_revoked,
      permit_revoked_at: s.permit_revoked_at,
      permit_revoked_reason: s.permit_revoked_reason,
      permit_revoked_notes: s.permit_revoked_notes,
      tow_flagged: s.tow_flagged,
      towed_at: s.towed_at,
      vehicle_plate: s.vehicle_plate,
      vehicle_make: s.vehicle_make,
      vehicle_model: s.vehicle_model,
      vehicle_year: s.vehicle_year,
      vehicle_color: s.vehicle_color,
      // Document file paths + upload flags (for document-upload queues)
      pet_addendum_file: s.pet_addendum_file,
      pet_addendum_uploaded_to_appfolio: s.pet_addendum_uploaded_to_appfolio,
      vehicle_addendum_file: s.vehicle_addendum_file,
      vehicle_addendum_uploaded_to_appfolio: s.vehicle_addendum_uploaded_to_appfolio,
      insurance_file: s.insurance_file,
      insurance_verified: s.insurance_verified,
      insurance_uploaded_to_appfolio: s.insurance_uploaded_to_appfolio,
      vehicle_verified: s.vehicle_verified,
      exemption_documents: s.exemption_documents,
      exemption_status: s.exemption_status,
      esa_doc_uploaded_to_appfolio: s.esa_doc_uploaded_to_appfolio,
    });

    // --- Queue filters ---

    // 1) Pickups awaiting AppFolio permit entry
    const permitPickups = subs.filter(s =>
      s.tenant_picked_up && !s.permit_entered_in_appfolio && !s.permit_revoked
    );

    // 2) IDs awaiting AppFolio upload
    const ids = subs.filter(s =>
      s.pickup_id_photo && !s.pickup_id_uploaded_to_appfolio && !s.permit_revoked
    );

    // 3) Pet fees awaiting AppFolio (verified + not exempt + not already added)
    const petFees = subs.filter(s =>
      s.has_pets && !s.has_fee_exemption && s.pet_verified && !s.pet_fee_added_to_appfolio
    );

    // 4) Permit fees awaiting AppFolio — ONLY bill tenants who actually picked up the permit.
    //    Previously used `permit_issued`, which flips true when the permit record is prepared
    //    from submission data; that caused tenants who never collected the permit to be billed.
    const permitFees = subs.filter(s =>
      s.tenant_picked_up && !s.permit_fee_added_to_appfolio && !s.permit_revoked
    );

    // 5) Auto-flagged move-outs (permit still active, current tenant no longer matches)
    const moveOutsRaw: Array<{ sub: any; current_tenant_name: string | null }> = [];
    for (const s of subs) {
      if (!s.permit_issued || s.permit_revoked) continue;
      const nb = normalizeAddress(s.building_address || '');
      const key = `${nb}|${s.unit_number}`;
      const currentName = currentTenantMap.get(key) ?? null;
      if (!currentName) {
        moveOutsRaw.push({ sub: s, current_tenant_name: null });
        continue;
      }
      const subName = (s.full_name || '').trim().toLowerCase();
      const curName = currentName.trim().toLowerCase();
      if (!subName) continue;
      const subTokens = subName.split(/\s+/).filter(Boolean);
      const curTokens = curName.split(/\s+/).filter(Boolean);
      const hasOverlap = subTokens.some((t: string) => curTokens.includes(t));
      if (!hasOverlap) moveOutsRaw.push({ sub: s, current_tenant_name: currentName });
    }
    const moveOuts = moveOutsRaw.map(m => m.sub);

    // 6) Tow list (revoked with plate, not yet towed)
    const towList = subs.filter(s => s.tow_flagged && !s.towed_at);

    // 7) Pet addendums awaiting AppFolio upload (file exists, verified, not yet uploaded)
    const petAddendums = subs.filter(s =>
      s.pet_addendum_file && s.pet_verified && !s.pet_addendum_uploaded_to_appfolio
    );

    // 8) Vehicle addendums (parking agreements) awaiting AppFolio upload.
    //    Gated on pickup — the parking agreement only applies to an active permit.
    const vehicleAddendums = subs.filter(s =>
      s.vehicle_addendum_file
      && s.vehicle_verified
      && s.tenant_picked_up
      && !s.permit_revoked
      && !s.vehicle_addendum_uploaded_to_appfolio
    );

    // 9) Insurance documents awaiting AppFolio upload
    const insuranceDocs = subs.filter(s =>
      s.insurance_file && s.insurance_verified && !s.insurance_uploaded_to_appfolio
    );

    // 10) ESA / exemption documents awaiting AppFolio upload
    const esaDocs = subs.filter(s => {
      const docs = s.exemption_documents;
      const hasDocs = Array.isArray(docs) ? docs.length > 0 : !!docs;
      return hasDocs && s.exemption_status === 'approved' && !s.esa_doc_uploaded_to_appfolio;
    });

    return NextResponse.json({
      success: true,
      permit_pickups_awaiting_appfolio: { count: permitPickups.length, rows: permitPickups.map(toRow) },
      permit_ids_awaiting_appfolio: { count: ids.length, rows: ids.map(toRow) },
      pet_fees_awaiting_appfolio: { count: petFees.length, rows: petFees.map(toRow) },
      permit_fees_awaiting_appfolio: { count: permitFees.length, rows: permitFees.map(toRow) },
      auto_flagged_moveouts: { count: moveOutsRaw.length, rows: moveOutsRaw.map(m => ({ ...toRow(m.sub), current_tenant_name: m.current_tenant_name })) },
      tow_list: { count: towList.length, rows: towList.map(toRow) },
      pet_addendums_awaiting_upload: { count: petAddendums.length, rows: petAddendums.map(toRow) },
      vehicle_addendums_awaiting_upload: { count: vehicleAddendums.length, rows: vehicleAddendums.map(toRow) },
      insurance_docs_awaiting_upload: { count: insuranceDocs.length, rows: insuranceDocs.map(toRow) },
      esa_docs_awaiting_upload: { count: esaDocs.length, rows: esaDocs.map(toRow) },
    });
  } catch (error: any) {
    console.error('appfolio-queue exception:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load queue' },
      { status: 500 }
    );
  }
}
