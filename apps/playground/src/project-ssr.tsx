import { renderToString } from 'react-dom/server';

import { ProjectPage } from './pages/ProjectPage';

export function renderProjectPage(search: string): string {
  return renderToString(<ProjectPage search={search} />);
}
