export type FormSubmissionStatus =
  | 'pending_review'
  | 'under_review'
  | 'approved'
  | 'denied'
  | 'revision_requested'
  | 'sent_to_appfolio'
  | 'completed';

export type FormPriority = 'low' | 'medium' | 'high';

export type FormCategory = 'maintenance' | 'compliance' | 'finance' | 'leasing' | 'general';

export interface FormTypeInfo {
  value: string;
  label: string;
  category: FormCategory;
  color: string;
}

export const statusLabels: Record<FormSubmissionStatus, string> = {
  pending_review: 'Pending Review',
  under_review: 'Under Review',
  approved: 'Approved',
  denied: 'Denied',
  revision_requested: 'Revision Requested',
  sent_to_appfolio: 'Sent to Appfolio',
  completed: 'Completed',
};

export const statusColors: Record<FormSubmissionStatus, string> = {
  pending_review: 'bg-yellow-100 text-yellow-800',
  under_review: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  denied: 'bg-red-100 text-red-800',
  revision_requested: 'bg-orange-100 text-orange-800',
  sent_to_appfolio: 'bg-purple-100 text-purple-800',
  completed: 'bg-gray-100 text-gray-800',
};

export const priorityLabels: Record<FormPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const priorityColors: Record<FormPriority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-red-100 text-red-700',
};

export const categoryColors: Record<FormCategory, string> = {
  maintenance: 'bg-blue-100 text-blue-800',
  compliance: 'bg-purple-100 text-purple-800',
  finance: 'bg-green-100 text-green-800',
  leasing: 'bg-orange-100 text-orange-800',
  general: 'bg-gray-100 text-gray-800',
};

export function convertSnakeCaseToTitleCase(str: string): string {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function detectFormCategory(formType: string): FormCategory {
  const lowerType = formType.toLowerCase();

  if (
    lowerType.includes('maintenance') ||
    lowerType.includes('repair') ||
    lowerType.includes('lockout')
  ) {
    return 'maintenance';
  }

  if (
    lowerType.includes('violation') ||
    lowerType.includes('unauthorized') ||
    lowerType.includes('pet') ||
    lowerType.includes('smoke')
  ) {
    return 'compliance';
  }

  if (
    lowerType.includes('billing') ||
    lowerType.includes('payment') ||
    lowerType.includes('dispute') ||
    lowerType.includes('cash')
  ) {
    return 'finance';
  }

  if (
    lowerType.includes('move') ||
    lowerType.includes('lease') ||
    lowerType.includes('inspection') ||
    lowerType.includes('renewal') ||
    lowerType.includes('forwarding')
  ) {
    return 'leasing';
  }

  return 'general';
}

export function getFormTypeInfo(formType: string): FormTypeInfo {
  const category = detectFormCategory(formType);
  const label = convertSnakeCaseToTitleCase(formType);
  const color = categoryColors[category];

  return {
    value: formType,
    label,
    category,
    color,
  };
}

export const STAFF_MEMBERS = ['Alex', 'Dean', 'Dan', 'Tiff'] as const;
export type StaffMember = (typeof STAFF_MEMBERS)[number];
