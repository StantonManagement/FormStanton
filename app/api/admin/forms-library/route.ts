import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { TenantForm, tenantForms } from '@/lib/formsData';

const VALID_DEPARTMENTS = ['leasing', 'property_management', 'maintenance', 'compliance', 'housing_programs', 'collections', 'hr'] as const;

type Department = (typeof VALID_DEPARTMENTS)[number];

type FormOverride = {
  form_id: number;
  title: string;
  department: Department;
  description: string;
  path: string | null;
  content: string | null;
  is_current: boolean;
};

function isValidDepartment(value: string): value is Department {
  return VALID_DEPARTMENTS.includes(value as Department);
}

function mergeForms(overrides: FormOverride[]): TenantForm[] {
  const overrideMap = new Map(overrides.map((override) => [override.form_id, override]));

  return tenantForms
    .map((form) => {
      const override = overrideMap.get(form.id);
      if (!override) {
        return form;
      }

      return {
        ...form,
        title: override.title,
        department: override.department,
        description: override.description,
        path: override.path ?? undefined,
        content: override.content ?? undefined,
      };
    })
    .sort((a, b) => a.id - b.id);
}

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();

    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const department = searchParams.get('department');
    const query = searchParams.get('q')?.trim().toLowerCase() ?? '';

    const { data, error } = await supabaseAdmin
      .from('admin_forms_library')
      .select('form_id, title, department, description, path, content, is_current')
      .eq('is_current', true);

    if (error) {
      throw error;
    }

    let mergedForms = mergeForms((data ?? []) as FormOverride[]);

    if (department && isValidDepartment(department)) {
      mergedForms = mergedForms.filter((form) => form.department === department);
    }

    if (query) {
      mergedForms = mergedForms.filter((form) => {
        const title = form.title.toLowerCase();
        const description = form.description.toLowerCase();
        const content = form.content?.toLowerCase() ?? '';

        return title.includes(query) || description.includes(query) || content.includes(query);
      });
    }

    return NextResponse.json({ success: true, data: mergedForms });
  } catch (error: any) {
    console.error('Forms library fetch error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to load forms library' },
      { status: 500 }
    );
  }
}
