import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

import type { GanttKeyboardAction } from '../../runtime';
import type { GanttInteractionState } from '../../types';

export function keyboardActionForEvent(
  event: ReactKeyboardEvent<HTMLElement>,
  editingMode?: Extract<GanttInteractionState, { readonly status: 'keyboard' }>['mode'] | 'link',
): GanttKeyboardAction | undefined {
  const adjustment =
    event.key === 'ArrowLeft'
      ? 'left'
      : event.key === 'ArrowRight'
        ? 'right'
        : event.key === 'ArrowUp'
          ? 'up'
          : event.key === 'ArrowDown'
            ? 'down'
            : undefined;
  if (editingMode !== undefined) {
    if (event.altKey || event.ctrlKey || event.metaKey) return undefined;
    if (editingMode === 'link') {
      if (adjustment !== undefined) return { direction: adjustment, type: 'navigate' };
      if (event.key === 'Home' || event.key === 'End') {
        return { direction: event.key === 'Home' ? 'home' : 'end', type: 'navigate' };
      }
      if (event.key === 'Enter') return { type: 'commit' };
      return event.key === 'Escape' ? { type: 'cancel' } : undefined;
    }
    if (editingMode === 'progress' && (event.key === 'Home' || event.key === 'End')) {
      return {
        boundary: event.key === 'Home' ? 'start' : 'end',
        direction: event.key === 'Home' ? 'left' : 'right',
        type: 'adjust',
      };
    }
    if (adjustment !== undefined) {
      return {
        ...(editingMode === 'progress' && event.shiftKey ? { accelerated: true } : {}),
        direction: adjustment,
        type: 'adjust',
      };
    }
    if (event.shiftKey) return undefined;
    if (event.key === 'Enter') return { type: 'commit' };
    return event.key === 'Escape' ? { type: 'cancel' } : undefined;
  }
  const platformModifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  if (platformModifier && !event.altKey && key === 'z') {
    return { action: event.shiftKey ? 'redo' : 'undo', type: 'history' };
  }
  if (platformModifier && !event.altKey && key === 'y') {
    return { action: 'redo', type: 'history' };
  }
  if (
    (event.key === 'PageUp' || event.key === 'PageDown') &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  ) {
    return {
      axis: event.altKey ? 'horizontal' : 'vertical',
      direction: event.key === 'PageUp' ? -1 : 1,
      type: 'page',
    };
  }
  if (!event.altKey && !event.ctrlKey && !event.metaKey) {
    if (event.key === '+' || event.key === '=') return { direction: 'in', type: 'zoom' };
    if (event.key === '-' || event.key === '_') return { direction: 'out', type: 'zoom' };
    if (event.key === '0' && !event.shiftKey) return { type: 'fit' };
  }
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return undefined;
  if (adjustment !== undefined) return { direction: adjustment, type: 'navigate' };
  if (event.key === 'Home' || event.key === 'End') {
    return { direction: event.key === 'Home' ? 'home' : 'end', type: 'navigate' };
  }
  if (event.key === ' ') return { type: 'toggle-selection' };
  if (event.key === 'Enter') return { type: 'activate' };
  if (key === 'm') return { mode: 'move', type: 'begin' };
  if (key === 'p') return { mode: 'progress', type: 'begin' };
  if (key === 's') return { mode: 'resize-start', type: 'begin' };
  if (key === 'e') return { mode: 'resize-end', type: 'begin' };
  if (key === 'n') return { type: 'create' };
  if (key === 'l') return { type: 'link' };
  return event.key === 'Delete' || event.key === 'Backspace' ? { type: 'delete' } : undefined;
}
