import { AppShell } from '@/components/AppShell';
import { useRouter } from '@/lib/router';
import { OverviewPage } from '@/pages/OverviewPage';
import { RegistryPage } from '@/pages/RegistryPage';
import { NewSubmissionPage } from '@/pages/NewSubmissionPage';
import { RecordDetailPage } from '@/pages/RecordDetailPage';
import { AuditHistoryPage } from '@/pages/AuditHistoryPage';
import { PublicVerificationPage } from '@/pages/PublicVerificationPage';

function App() {
  const { route } = useRouter();

  let page;
  switch (route.name) {
    case 'overview':
      page = <OverviewPage />;
      break;
    case 'registry':
      page = <RegistryPage />;
      break;
    case 'new-submission':
      page = <NewSubmissionPage />;
      break;
    case 'record':
      page = <RecordDetailPage id={route.id} />;
      break;
    case 'audit-history':
      page = <AuditHistoryPage />;
      break;
    case 'public-verification':
      page = <PublicVerificationPage />;
      break;
    default:
      page = <OverviewPage />;
  }

  return <AppShell>{page}</AppShell>;
}

export default App;
