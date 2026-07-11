import { DirectoryProfilePage } from '@/features/directory/components/DirectoryProfilePage'
export const dynamic = 'force-dynamic'
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <DirectoryProfilePage kind="managers" id={id} /> }
