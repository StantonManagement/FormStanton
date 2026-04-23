import TokenRouter from '@/components/TokenRouter';

export default async function TenantPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return <TokenRouter token={token} />;
}
