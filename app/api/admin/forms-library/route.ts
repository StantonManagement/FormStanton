import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { TenantForm, tenantForms } from '@/lib/formsData';

const VALID_DEPARTMENTS = [
  'leasing', 'property_management', 'maintenance', 'compliance',
  'housing_programs', 'collections', 'hr', 'finance', 'uncategorized',
] as const;

type Department = (typeof VALID_DEPARTMENTS)[number];

// Slugs that are not tenant-facing forms and should never appear in the library
const EXCLUDED_SLUGS = new Set([
  'admin', 'hach', 'api', 'form', 't', 'pbv-full-app',
]);

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

function humanizeSlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function discoverFormRoutes(): string[] {
  try {
    const appDir = path.join(process.cwd(), 'app');
    const entries = fs.readdirSync(appDir, { withFileTypes: true });
    const routes: string[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const slug = entry.name;
      // Skip excluded slugs, dynamic segments, and hidden folders
      if (EXCLUDED_SLUGS.has(slug) || slug.startsWith('[') || slug.startsWith('_') || slug.startsWith('.')) continue;
      // Must have a page.tsx directly inside (not just a print/ subpage)
      const pagePath = path.join(appDir, slug, 'page.tsx');
      if (fs.existsSync(pagePath)) {
        routes.push(`/${slug}`);
      }
    }

    return routes;
  } catch {
    return [];
  }
}

function mergeForms(overrides: FormOverride[]): TenantForm[] {
  const overrideMap = new Map(overrides.map((override) => [override.form_id, override]));
  const pathOverrideMap = new Map(overrides.map((override) => [override.path, override]));

  // Start from the static registry, applying DB overrides
  const knownPaths = new Set(tenantForms.map((f) => f.path).filter(Boolean));
  const registryForms: TenantForm[] = tenantForms.map((form) => {
    const override = overrideMap.get(form.id);
    if (!override) return form;
    return {
      ...form,
      title: override.title,
      department: override.department as TenantForm['department'],
      description: override.description,
      path: override.path ?? undefined,
      content: override.content ?? undefined,
    };
  });

  // Discover filesystem routes and add any not already in the registry
  const discoveredRoutes = discoverFormRoutes();
  let nextId = Math.max(...tenantForms.map((f) => f.id), 1000);

  const discoveredForms: TenantForm[] = [];
  for (const route of discoveredRoutes) {
    if (knownPaths.has(route)) continue; // already in registry
    // Check if there's a DB override for this path (admin re-categorized it)
    const pathOverride = pathOverrideMap.get(route);
    discoveredForms.push({
      id: ++nextId,
      title: pathOverride?.title ?? humanizeSlug(route.slice(1)),
      department: (pathOverride?.department as TenantForm['department']) ?? 'uncategorized',
      description: pathOverride?.description ?? '',
      path: route,
    });
  }

  return [...registryForms, ...discoveredForms].sort((a, b) => {
    // Registry forms first (id < 1000), then discovered alphabetically
    if (a.id < 1000 && b.id >= 1000) return -1;
    if (a.id >= 1000 && b.id < 1000) return 1;
    return a.title.localeCompare(b.title);
  });
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
