import { DirectoryPage } from '@/features/directory/components/DirectoryPage'
// Dados do diretorio precisam do Supabase apenas em tempo de requisicao.
// O servico de listagem preserva cache de dados de 30 segundos via unstable_cache.
export const dynamic = 'force-dynamic'
export default function Page() { return <DirectoryPage kind="managers" /> }
