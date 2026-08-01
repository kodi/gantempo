import { CircleDot, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ReactElement } from 'react';

import type { GanttContextMenuItem, GanttContextMenuProps } from '../types';

export function DefaultContextMenu({
  bindings,
  items,
  onSelect,
  task,
}: GanttContextMenuProps): ReactElement {
  return (
    <div {...bindings}>
      <div aria-hidden="true" className="gt-gantt__context-menu-header">
        <span>Task actions</span>
        <strong>{task.title}</strong>
      </div>
      <div className="gt-gantt__context-menu-items">
        {items.map((item) => (
          <button
            aria-label={
              item.disabledReason === undefined
                ? item.label
                : `${item.label}: ${item.disabledReason}`
            }
            className="gt-gantt__context-menu-item"
            data-destructive={item.action === 'delete' ? 'true' : undefined}
            disabled={item.disabledReason !== undefined}
            key={item.id}
            onClick={() => onSelect(item)}
            role="menuitem"
            title={item.disabledReason}
            type="button"
          >
            <span aria-hidden="true" className="gt-gantt__context-menu-icon">
              <MenuItemIcon item={item} />
            </span>
            <span className="gt-gantt__context-menu-copy">
              <span>{item.label}</span>
              {item.disabledReason === undefined ? null : <small>{item.disabledReason}</small>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MenuItemIcon({ item }: { readonly item: GanttContextMenuItem }): ReactElement {
  const Icon =
    item.action === 'create'
      ? Plus
      : item.action === 'edit'
        ? Pencil
        : item.action === 'delete'
          ? Trash2
          : CircleDot;
  return <Icon focusable="false" strokeWidth={1.9} />;
}
