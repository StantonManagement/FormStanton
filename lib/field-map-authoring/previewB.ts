/**
 * lib/field-map-authoring/previewB.ts
 *
 * PRD-86 Phase A — Preview B: the text-filled render.
 *
 * Renders via `stampForm()` with a representative sample dataset. This MUST be the
 * exact production render path, so preview == what an applicant will sign.
 */

import { stampForm } from '@/lib/pbv/form-generation/stamper';
import { type FieldMap } from './types';

export async function renderPreviewB(
  sourcePdfBytes: Uint8Array,
  fieldMap: FieldMap,
  data: Record<string, unknown>
): Promise<Buffer> {
  return stampForm({ fieldMap, data, sourcePdfBytes });
}
