import { describe, expect, it } from 'vite-plus/test';
import { isValidElement } from 'react';

import { Gantt } from './index';

describe('Gantt', () => {
  it('exposes an accessible region by default', () => {
    const element = Gantt({});

    if (!isValidElement<Record<string, unknown>>(element)) {
      throw new Error('Expected Gantt to return a React element');
    }

    expect(element.props['aria-label']).toBe('Gantt chart');
    expect(element.props.role).toBe('region');
  });
});
