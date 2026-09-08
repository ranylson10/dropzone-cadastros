import '@/features/directory/components/championship-directory.css'
import { DirectoryPage } from '@/features/directory/components/DirectoryPage'
export const revalidate = 30
export default function Page() { return <DirectoryPage kind="campeonatos" /> }
