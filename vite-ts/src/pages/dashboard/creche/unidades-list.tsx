import { CONFIG } from 'src/global-config';

import { UnidadeListView } from 'src/sections/unidade/view/unidade-list-view';

// ----------------------------------------------------------------------

const metadata = { title: `Unidades — ${CONFIG.appName}` };

export default function UnidadesListPage() {
  return (
    <>
      <title>{metadata.title}</title>
      <UnidadeListView />
    </>
  );
}
