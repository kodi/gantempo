import { hydrateRoot, type HydrationOptions, type Root } from 'react-dom/client';

import { ProjectPage } from './pages/ProjectPage';

export function hydrateProjectPage(
  container: Element,
  search: string,
  options?: HydrationOptions,
): Root {
  return hydrateRoot(container, <ProjectPage search={search} />, options);
}
