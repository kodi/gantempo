import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Playground } from './Playground';
import './styles.css';

const rootElement = document.querySelector('#root');

if (!(rootElement instanceof HTMLElement)) {
  throw new Error('Expected the playground root element to exist');
}

createRoot(rootElement).render(
  <StrictMode>
    <Playground />
  </StrictMode>,
);
