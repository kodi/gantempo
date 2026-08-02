import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Playground } from './Playground';
import '@gantempo/gantt/styles.css';
import './styles.css';

const queryClient = new QueryClient();

const rootElement = document.querySelector('#root');

if (!(rootElement instanceof HTMLElement)) {
  throw new Error('Expected the playground root element to exist');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Playground />
    </QueryClientProvider>
  </StrictMode>,
);
