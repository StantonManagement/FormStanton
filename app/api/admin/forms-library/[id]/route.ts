import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { tenantForms } from '@/lib/formsData';

const VALID_DEPARTMENTS = ['property_management', 'maintenance', 'compliance', 'finance'] as const;
type Department = (typeof VALID_DEPARTMENTS)[number];

type FormUpdatePayload = {
  title?: string;
  department?: Department;
  description?: string;
  path?: string | null;
  content?: string | null;
};

function isValidDepartment(value: string): value is Department {
  return VALID_DEPARTMENTS.includes(value as Department);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const formId = Number(id);

    if (!Number.isInteger(formId) || formId < 1) {
      return NextResponse.json({ success: false, message: 'Invalid form ID' }, { status: 400 });
    }

    const payload = (await request.json()) as FormUpdatePayload;

    const baseForm = tenantForms.find((form) => form.id === formId);

    const { data: existingOverride, error: existingOverrideError } = await supabaseAdmin
      .from('admin_forms_library')
      .select('form_id, title, department, description, path, content, created_by')
      .eq('form_id', formId)
      .maybeSingle();

    if (existingOverrideError) {
      throw existingOverrideError;
    }

    if (!baseForm && !existingOverride) {
      return NextResponse.json({ success: false, message: 'Form not found' }, { status: 404 });
    }

    const currentTitle = existingOverride?.title ?? baseForm?.title ?? '';
    const currentDepartment = (existingOverride?.department ?? baseForm?.department ?? 'property_management') as Department;
    const currentDescription = existingOverride?.description ?? baseForm?.description ?? '';
    const currentPath = existingOverride?.path ?? baseForm?.path ?? null;
    const currentContent = existingOverride?.content ?? baseForm?.content ?? null;

    const title = typeof payload.title === 'string' ? payload.title.trim() : currentTitle;
    const description = typeof payload.description === 'string' ? payload.description.trim() : currentDescription;
    const department = payload.department ?? currentDepartment;

    const path =
      payload.path === null
        ? null
        : typeof payload.path === 'string'
          ? payload.path.trim() || null
          : currentPath;

    const content =
      payload.content === null
        ? null
        : typeof payload.content === 'string'
          ? payload.content
          : currentContent;

    if (!title) {
      return NextResponse.json({ success: false, message: 'Title is required' }, { status: 400 });
    }

    if (!description) {
      return NextResponse.json({ success: false, message: 'Description is required' }, { status: 400 });
    }

    if (!isValidDepartment(department)) {
      return NextResponse.json({ success: false, message: 'Invalid department' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('admin_forms_library')
      .upsert(
        {
          form_id: formId,
          title,
          department,
          description,
          path,
          content,
          is_current: true,
          created_by: existingOverride?.created_by ?? 'admin',
        },
        { onConflict: 'form_id' }
      )
      .select('form_id, title, department, description, path, content')
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: formId,
        title: data.title,
        department: data.department,
        description: data.description,
        path: data.path ?? undefined,
        content: data.content ?? undefined,
      },
    });
  } catch (error: any) {
    console.error('Forms library update error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update form' },
      { status: 500 }
    );
  }
}
