import ComplianceClient from '@/components/compliance/ComplianceClient';

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const initialProject = params.project || 'legacy';

  return <ComplianceClient initialProject={initialProject} />;
}
