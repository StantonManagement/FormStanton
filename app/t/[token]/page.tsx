import TenantPortal from '@/components/TenantPortal';

export default async function TenantPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <TenantPortal token={token} />;
}
