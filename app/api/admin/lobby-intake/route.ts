import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { normalizeAddress } from '@/lib/addressNormalizer';

function normalizeForMatching(str: string | null | undefined): string {
  return (str || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

async function findActiveUnitSubmissions(building: string, unit: string) {
  const normalizedBuilding = normalizeAddress(building).toLowerCase();
  const normalizedUnit = normalizeForMatching(unit);

  const { data: candidates } = await supabaseAdmin
    .from('submissions')
    .select('*')
    .ilike('unit_number', unit.trim())
    .is('merged_into', null)
    .order('created_at', { ascending: false });

  const scopedCandidates = (candidates || []).filter((candidate) => {
    const candidateBuilding = normalizeAddress(candidate.building_address).toLowerCase();
    const candidateUnit = normalizeForMatching(candidate.unit_number);
    return candidateBuilding === normalizedBuilding && candidateUnit === normalizedUnit;
  });

  return scopedCandidates;
}

async function resolveCanonicalSubmission(building: string, unit: string): Promise<{
  submission: any | null;
  canonicalSelectionRequired: boolean;
  candidateIds: string[];
}> {
  const candidates = await findActiveUnitSubmissions(building, unit);
  if (candidates.length === 0) {
    return { submission: null, canonicalSelectionRequired: false, candidateIds: [] };
  }

  if (candidates.length === 1) {
    return {
      submission: candidates[0],
      canonicalSelectionRequired: false,
      candidateIds: [candidates[0].id],
    };
  }

  const primarySubs = candidates.filter((candidate) => candidate.is_primary === true);
  if (primarySubs.length === 1) {
    return {
      submission: primarySubs[0],
      canonicalSelectionRequired: false,
      candidateIds: candidates.map((candidate) => candidate.id),
    };
  }

  return {
    submission: null,
    canonicalSelectionRequired: true,
    candidateIds: candidates.map((candidate) => candidate.id),
  };
}

/**
 * PATCH — Save lobby_notes on an existing submission.
 * Resets lobby_notes_processed = false so compliance re-reads.
 */
export async function PATCH(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tenant_name, building_address, unit_number, lobby_notes } = body;

    if (!building_address || !unit_number) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields (building_address, unit_number)' },
        { status: 400 }
      );
    }

    const sessionUser = await getSessionUser();
    const performedBy = sessionUser?.displayName || 'Unknown';

    const canonicalResolution = await resolveCanonicalSubmission(building_address, unit_number);
    if (canonicalResolution.canonicalSelectionRequired) {
      return NextResponse.json(
        {
          success: false,
          message: 'Canonical selection required before updating lobby notes for this unit',
          canonicalSelectionRequired: true,
          candidateIds: canonicalResolution.candidateIds,
        },
        { status: 409 }
      );
    }

    const existing = canonicalResolution.submission;
    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'No submission found for this unit' },
        { status: 404 }
      );
    }

    const { data: updated, error } = await supabaseAdmin
      .from('submissions')
      .update({
        lobby_notes: lobby_notes || null,
        lobby_notes_processed: false,
        lobby_notes_updated_at: new Date().toISOString(),
        lobby_notes_updated_by: performedBy,
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error saving lobby notes:', error);
      return NextResponse.json({ success: false, message: 'Failed to save lobby notes' }, { status: 500 });
    }

    await logAudit(sessionUser, 'lobby_intake.update_notes', 'submission', existing.id, {
      tenant_name, building_address, unit_number,
      has_notes: !!lobby_notes,
    }, getClientIp(request));

    return NextResponse.json({ success: true, submissionData: updated });
  } catch (error: any) {
    console.error('Lobby intake PATCH error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to save lobby notes' },
      { status: 500 }
    );
  }
}

/**
 * Lobby Intake API — upserts submissions table AND logs to tenant_interactions.
 * Handles pet_registration and vehicle_registration action types.
 */
export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tenant_name, building_address, unit_number, action_type, action_data, notes } = body;

    const sessionUser = await getSessionUser();
    const performedBy = sessionUser?.displayName || body.performed_by || 'Unknown';

    if (!tenant_name || !building_address || !unit_number || !action_type) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const canonicalResolution = await resolveCanonicalSubmission(building_address, unit_number);
    if (canonicalResolution.canonicalSelectionRequired) {
      return NextResponse.json(
        {
          success: false,
          message: 'Canonical selection required before intake actions for this unit',
          canonicalSelectionRequired: true,
          candidateIds: canonicalResolution.candidateIds,
        },
        { status: 409 }
      );
    }

    const canonicalExisting = canonicalResolution.submission;

    // 1. Log to tenant_interactions (history)
    const { data: interaction, error: ixError } = await supabaseAdmin
      .from('tenant_interactions')
      .insert({
        tenant_name,
        building_address,
        unit_number,
        action_type,
        action_data: action_data || {},
        notes: notes || null,
        performed_by: performedBy,
      })
      .select()
      .single();

    if (ixError) {
      console.error('Error saving interaction:', ixError);
      return NextResponse.json(
        { success: false, message: 'Failed to save interaction' },
        { status: 500 }
      );
    }

    // 2. Upsert submissions table so compliance pipeline sees the data
    let submissionData = null;

    if (action_type === 'id_photo_upload') {
      const existing = canonicalExisting;

      if (existing) {
        submissionData = existing;
      } else {
        const { data: created, error: createErr } = await supabaseAdmin
          .from('submissions')
          .insert({
            full_name: tenant_name,
            building_address,
            unit_number,
            has_pets: false,
            has_vehicle: false,
            has_insurance: false,
            add_insurance_to_rent: false,
            insurance_upload_pending: false,
            language: 'en',
          })
          .select('*')
          .single();

        if (createErr) {
          console.error('Error creating submission for ID photo:', createErr);
        } else {
          submissionData = created;
        }
      }
    }

    if (action_type === 'esa_document_received') {
      // Find existing submission
      const existing = canonicalExisting;

      if (existing) {
        const { data: updated, error: updateErr } = await supabaseAdmin
          .from('submissions')
          .update({
            exemption_status: existing.exemption_status || 'pending',
            exemption_reason: action_data.reason || existing.exemption_reason || 'emotional_support',
          })
          .eq('id', existing.id)
          .select('*')
          .single();

        if (!updateErr) submissionData = updated;
      } else {
        const { data: created, error: createErr } = await supabaseAdmin
          .from('submissions')
          .insert({
            full_name: tenant_name,
            building_address,
            unit_number,
            has_pets: true,
            has_vehicle: false,
            has_insurance: false,
            add_insurance_to_rent: false,
            insurance_upload_pending: false,
            language: 'en',
            exemption_status: 'pending',
            exemption_reason: action_data.reason || 'emotional_support',
          })
          .select('*')
          .single();

        if (!createErr) submissionData = created;
      }
    }

    if (action_type === 'pet_registration' || action_type === 'pet_update' || action_type === 'pet_removal' || action_type === 'vehicle_registration' || action_type === 'vehicle_update' || action_type === 'vehicle_removal') {
      // Find existing submission by building + unit + normalized name
      const existing = canonicalExisting;

      if (action_type === 'pet_registration') {
        const petObj = action_data.pets?.[0] || {};
        const newPet = {
          pet_type: petObj.type || null,
          pet_name: petObj.name || null,
          pet_breed: petObj.breed || null,
          pet_weight: petObj.weight ? parseInt(petObj.weight) : null,
          pet_spayed: petObj.spayed_neutered || null,
          pet_vaccinations_current: petObj.vaccines || null,
        };

        if (existing) {
          // Append pet to existing pets array
          const existingPets = Array.isArray(existing.pets) ? existing.pets : [];
          const updatedPets = [...existingPets, newPet];

          const { data: updated, error: updateErr } = await supabaseAdmin
            .from('submissions')
            .update({
              has_pets: true,
              pets: updatedPets,
            })
            .eq('id', existing.id)
            .select('*')
            .single();

          if (updateErr) {
            console.error('Error updating submission pets:', updateErr);
          } else {
            submissionData = updated;
          }
        } else {
          // Create minimal submission
          const { data: created, error: createErr } = await supabaseAdmin
            .from('submissions')
            .insert({
              full_name: tenant_name,
              building_address,
              unit_number,
              has_pets: true,
              pets: [newPet],
              has_vehicle: false,
              has_insurance: false,
              add_insurance_to_rent: false,
              insurance_upload_pending: false,
              language: 'en',
            })
            .select('*')
            .single();

          if (createErr) {
            console.error('Error creating submission for pet:', createErr);
          } else {
            submissionData = created;
          }
        }
      }

      if (action_type === 'pet_update') {
        if (!existing) {
          return NextResponse.json(
            { success: false, message: 'No submission found to update' },
            { status: 404 }
          );
        }

        const petIndex = action_data.pet_index;
        const petObj = action_data.pets?.[0] || {};
        const updatedPet = {
          pet_type: petObj.type || null,
          pet_name: petObj.name || null,
          pet_breed: petObj.breed || null,
          pet_weight: petObj.weight ? parseInt(petObj.weight) : null,
          pet_spayed: petObj.spayed_neutered || null,
          pet_vaccinations_current: petObj.vaccines || null,
        };

        const existingPets = Array.isArray(existing.pets) ? [...existing.pets] : [];
        if (petIndex >= 0 && petIndex < existingPets.length) {
          existingPets[petIndex] = updatedPet;

          const { data: updated, error: updateErr } = await supabaseAdmin
            .from('submissions')
            .update({
              has_pets: true,
              pets: existingPets,
            })
            .eq('id', existing.id)
            .select('*')
            .single();

          if (updateErr) {
            console.error('Error updating pet:', updateErr);
          } else {
            submissionData = updated;
          }
        }
      }

      if (action_type === 'pet_removal') {
        if (!existing) {
          return NextResponse.json(
            { success: false, message: 'No submission found' },
            { status: 404 }
          );
        }

        const petIndex = action_data.pet_index;
        const existingPets = Array.isArray(existing.pets) ? [...existing.pets] : [];
        
        if (petIndex >= 0 && petIndex < existingPets.length) {
          existingPets.splice(petIndex, 1);

          const { data: updated, error: updateErr } = await supabaseAdmin
            .from('submissions')
            .update({
              has_pets: existingPets.length > 0,
              pets: existingPets.length > 0 ? existingPets : null,
            })
            .eq('id', existing.id)
            .select('*')
            .single();

          if (updateErr) {
            console.error('Error removing pet:', updateErr);
          } else {
            submissionData = updated;
          }
        }
      }

      if (action_type === 'vehicle_registration') {
        const newVehicle = {
          vehicle_make: action_data.make || null,
          vehicle_model: action_data.model || null,
          vehicle_year: action_data.year ? parseInt(action_data.year) : null,
          vehicle_color: action_data.color || null,
          vehicle_plate: (action_data.plate || '').toUpperCase() || null,
          vehicle_type: action_data.vehicle_type || 'standard',
        };

        if (existing && existing.has_vehicle && existing.vehicle_make) {
          // Primary vehicle already exists — append to additional_vehicles
          const existingAdditional = Array.isArray(existing.additional_vehicles) ? existing.additional_vehicles : [];
          const updatedAdditional = [...existingAdditional, newVehicle];

          const { data: updated, error: updateErr } = await supabaseAdmin
            .from('submissions')
            .update({ additional_vehicles: updatedAdditional })
            .eq('id', existing.id)
            .select('*')
            .single();

          if (updateErr) {
            console.error('Error appending additional vehicle:', updateErr);
          } else {
            submissionData = updated;
          }
        } else if (existing) {
          // Submission exists but no primary vehicle — set flat fields
          const { data: updated, error: updateErr } = await supabaseAdmin
            .from('submissions')
            .update({
              has_vehicle: true,
              vehicle_make: newVehicle.vehicle_make,
              vehicle_model: newVehicle.vehicle_model,
              vehicle_year: newVehicle.vehicle_year,
              vehicle_color: newVehicle.vehicle_color,
              vehicle_plate: newVehicle.vehicle_plate,
              vehicle_type: newVehicle.vehicle_type,
            })
            .eq('id', existing.id)
            .select('*')
            .single();

          if (updateErr) {
            console.error('Error updating submission vehicle:', updateErr);
          } else {
            submissionData = updated;
          }
        } else {
          const { data: created, error: createErr } = await supabaseAdmin
            .from('submissions')
            .insert({
              full_name: tenant_name,
              building_address,
              unit_number,
              has_vehicle: true,
              vehicle_make: newVehicle.vehicle_make,
              vehicle_model: newVehicle.vehicle_model,
              vehicle_year: newVehicle.vehicle_year,
              vehicle_color: newVehicle.vehicle_color,
              vehicle_plate: newVehicle.vehicle_plate,
              vehicle_type: newVehicle.vehicle_type,
              has_pets: false,
              has_insurance: false,
              add_insurance_to_rent: false,
              insurance_upload_pending: false,
              language: 'en',
            })
            .select('*')
            .single();

          if (createErr) {
            console.error('Error creating submission for vehicle:', createErr);
          } else {
            submissionData = created;
          }
        }
      }

      if (action_type === 'vehicle_update') {
        if (!existing) {
          return NextResponse.json(
            { success: false, message: 'No submission found to update' },
            { status: 404 }
          );
        }

        const vehicleIndex = action_data.vehicle_index;
        const updatedVehicle = {
          vehicle_make: action_data.make || null,
          vehicle_model: action_data.model || null,
          vehicle_year: action_data.year ? parseInt(action_data.year) : null,
          vehicle_color: action_data.color || null,
          vehicle_plate: (action_data.plate || '').toUpperCase() || null,
          vehicle_type: action_data.vehicle_type || 'standard',
        };

        if (vehicleIndex === 0) {
          // Update primary vehicle (flat fields)
          const { data: updated, error: updateErr } = await supabaseAdmin
            .from('submissions')
            .update({
              vehicle_make: updatedVehicle.vehicle_make,
              vehicle_model: updatedVehicle.vehicle_model,
              vehicle_year: updatedVehicle.vehicle_year,
              vehicle_color: updatedVehicle.vehicle_color,
              vehicle_plate: updatedVehicle.vehicle_plate,
              vehicle_type: updatedVehicle.vehicle_type,
            })
            .eq('id', existing.id)
            .select('*')
            .single();

          if (updateErr) {
            console.error('Error updating primary vehicle:', updateErr);
          } else {
            submissionData = updated;
          }
        } else {
          // Update entry in additional_vehicles
          const additionalVehicles = Array.isArray(existing.additional_vehicles) ? [...existing.additional_vehicles] : [];
          const arrIndex = vehicleIndex - 1;
          if (arrIndex >= 0 && arrIndex < additionalVehicles.length) {
            additionalVehicles[arrIndex] = updatedVehicle;

            const { data: updated, error: updateErr } = await supabaseAdmin
              .from('submissions')
              .update({ additional_vehicles: additionalVehicles })
              .eq('id', existing.id)
              .select('*')
              .single();

            if (updateErr) {
              console.error('Error updating additional vehicle:', updateErr);
            } else {
              submissionData = updated;
            }
          }
        }
      }

      if (action_type === 'vehicle_removal') {
        if (!existing) {
          return NextResponse.json(
            { success: false, message: 'No submission found' },
            { status: 404 }
          );
        }

        const vehicleIndex = action_data.vehicle_index;
        const additionalVehicles = Array.isArray(existing.additional_vehicles) ? [...existing.additional_vehicles] : [];

        if (vehicleIndex === 0) {
          // Removing primary vehicle — promote first additional if available
          if (additionalVehicles.length > 0) {
            const promoted = additionalVehicles.shift();
            const { data: updated, error: updateErr } = await supabaseAdmin
              .from('submissions')
              .update({
                vehicle_make: promoted.vehicle_make || null,
                vehicle_model: promoted.vehicle_model || null,
                vehicle_year: promoted.vehicle_year || null,
                vehicle_color: promoted.vehicle_color || null,
                vehicle_plate: promoted.vehicle_plate || null,
                vehicle_type: promoted.vehicle_type || 'standard',
                additional_vehicles: additionalVehicles.length > 0 ? additionalVehicles : null,
              })
              .eq('id', existing.id)
              .select('*')
              .single();

            if (updateErr) {
              console.error('Error promoting vehicle:', updateErr);
            } else {
              submissionData = updated;
            }
          } else {
            // No additional vehicles — clear vehicle entirely
            const { data: updated, error: updateErr } = await supabaseAdmin
              .from('submissions')
              .update({
                has_vehicle: false,
                vehicle_make: null,
                vehicle_model: null,
                vehicle_year: null,
                vehicle_color: null,
                vehicle_plate: null,
                vehicle_type: null,
                additional_vehicles: null,
              })
              .eq('id', existing.id)
              .select('*')
              .single();

            if (updateErr) {
              console.error('Error clearing vehicle:', updateErr);
            } else {
              submissionData = updated;
            }
          }
        } else {
          // Removing from additional_vehicles array
          const arrIndex = vehicleIndex - 1;
          if (arrIndex >= 0 && arrIndex < additionalVehicles.length) {
            additionalVehicles.splice(arrIndex, 1);

            const { data: updated, error: updateErr } = await supabaseAdmin
              .from('submissions')
              .update({
                additional_vehicles: additionalVehicles.length > 0 ? additionalVehicles : null,
              })
              .eq('id', existing.id)
              .select('*')
              .single();

            if (updateErr) {
              console.error('Error removing additional vehicle:', updateErr);
            } else {
              submissionData = updated;
            }
          }
        }
      }
    }

    await logAudit(sessionUser, 'lobby_intake.create', 'tenant_interaction', interaction?.id, {
      tenant_name, building_address, unit_number, action_type,
      submission_upserted: !!submissionData,
    }, getClientIp(request));

    return NextResponse.json({
      success: true,
      interaction,
      submissionData,
    });
  } catch (error: any) {
    console.error('Lobby intake error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to process lobby intake' },
      { status: 500 }
    );
  }
}
