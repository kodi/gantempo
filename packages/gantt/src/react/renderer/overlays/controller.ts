import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';

import type { GanttInteractionState, GanttOverlayContainer, GanttProps } from '../../types';
import type { GanttBuiltInTheme, GanttDensity } from '../../../theme';

export interface TaskOverlayPosition {
  readonly adjusted?: boolean;
  readonly viewKey: string;
  readonly x: number;
  readonly y: number;
}

export interface EditorOverlay {
  readonly error?: string;
  readonly kind: 'dependency' | 'lane' | 'task';
  readonly mode: 'legacy' | 'properties';
  readonly pending: boolean;
  readonly selectionKey?: string;
  readonly viewKey: string;
}

export type OverlayBoundary = 'root' | 'viewport';

const OVERLAY_SAFE_AREA = 8;
const THEME_PROPERTIES = [
  '--gt-color-border',
  '--gt-color-empty',
  '--gt-color-focus',
  '--gt-color-grid',
  '--gt-color-surface',
  '--gt-color-surface-muted',
  '--gt-color-task',
  '--gt-color-task-text',
  '--gt-color-text',
  '--gt-color-text-muted',
  '--gt-header-height',
  '--gt-row-height',
  '--gt-z-overlay',
] as const;

const DEVELOPMENT =
  (import.meta as ImportMeta & { readonly env?: { readonly DEV?: boolean } }).env?.DEV === true;

function resolveOverlayTarget(
  container: GanttOverlayContainer | undefined,
  root: HTMLElement,
): Element | DocumentFragment | null {
  const resolved = typeof container === 'function' ? container() : container;
  if (resolved === 'root') return null;
  if (resolved === undefined || resolved === 'document') return root.ownerDocument.body;
  return resolved;
}

function syncOverlayTheme(root: HTMLElement, host: HTMLElement): void {
  const view = root.ownerDocument.defaultView;
  if (view === null) return;
  const computed = view.getComputedStyle(root);
  const properties = new Set<string>(THEME_PROPERTIES);
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    if (property.startsWith('--gt-')) properties.add(property);
  }
  for (const property of properties) {
    const value = computed.getPropertyValue(property);
    if (value !== '') host.style.setProperty(property, value);
  }
  host.style.fontFamily = computed.fontFamily;
  host.style.fontSize = computed.fontSize;
  host.style.lineHeight = computed.lineHeight;
}

function syncOverlayThemeAttributes(
  host: HTMLElement,
  density: GanttDensity,
  themeId: string,
  themeMode: GanttBuiltInTheme,
): void {
  host.dataset.gtDensity = density;
  host.dataset.gtTheme = themeId;
  host.dataset.gtThemeMode = themeMode;
}

function adjustedOverlayPosition(
  position: TaskOverlayPosition,
  surface: HTMLElement,
  host: HTMLElement,
  boundary: OverlayBoundary,
): TaskOverlayPosition {
  const surfaceRect = surface.getBoundingClientRect();
  const hostRect = host.getBoundingClientRect();
  const view = host.ownerDocument.defaultView;
  const hasMeasuredHost = hostRect.width > 0 && hostRect.height > 0;
  const bounds =
    boundary === 'viewport'
      ? {
          bottom: hasMeasuredHost ? hostRect.bottom : (view?.innerHeight ?? hostRect.bottom),
          left: hasMeasuredHost ? hostRect.left : 0,
          right: hasMeasuredHost ? hostRect.right : (view?.innerWidth ?? hostRect.right),
          top: hasMeasuredHost ? hostRect.top : 0,
        }
      : hostRect;
  let x = position.x;
  let y = position.y;
  if (surfaceRect.right > bounds.right - OVERLAY_SAFE_AREA) {
    x -= surfaceRect.right - (bounds.right - OVERLAY_SAFE_AREA);
  }
  if (surfaceRect.left < bounds.left + OVERLAY_SAFE_AREA) {
    x += bounds.left + OVERLAY_SAFE_AREA - surfaceRect.left;
  }
  if (surfaceRect.bottom > bounds.bottom - OVERLAY_SAFE_AREA) {
    y -= surfaceRect.bottom - (bounds.bottom - OVERLAY_SAFE_AREA);
  }
  if (surfaceRect.top < bounds.top + OVERLAY_SAFE_AREA) {
    y += bounds.top + OVERLAY_SAFE_AREA - surfaceRect.top;
  }
  return { ...position, adjusted: true, x, y };
}

export interface OverlayController {
  readonly boundary: OverlayBoundary;
  readonly closeEditor: (restoreFocus?: boolean) => void;
  readonly closeMenu: (restoreFocus?: boolean) => void;
  readonly editor: EditorOverlay | undefined;
  readonly editorErrorId: string;
  readonly editorId: string;
  readonly editorSurfaceRef: RefObject<HTMLDivElement | null>;
  readonly host: HTMLDivElement | null;
  readonly menu: TaskOverlayPosition | undefined;
  readonly menuId: string;
  readonly menuSurfaceRef: RefObject<HTMLDivElement | null>;
  readonly position: (
    viewKey: string,
    element: Element,
    clientX?: number,
    clientY?: number,
  ) => TaskOverlayPosition;
  readonly setEditor: Dispatch<SetStateAction<EditorOverlay | undefined>>;
  readonly setLocalHost: Dispatch<SetStateAction<HTMLDivElement | null>>;
  readonly setMenu: Dispatch<SetStateAction<TaskOverlayPosition | undefined>>;
  readonly setTooltip: Dispatch<SetStateAction<TaskOverlayPosition | undefined>>;
  readonly showTooltip: (enabled: boolean, viewKey: string, element: Element) => void;
  readonly tooltip: TaskOverlayPosition | undefined;
  readonly tooltipId: string;
  readonly tooltipSurfaceRef: RefObject<HTMLDivElement | null>;
}

export function useOverlayController({
  accessibilityId,
  className,
  density,
  interaction,
  overlayContainer,
  rootRef,
  slots,
  themeId,
  themeMode,
  themeRevision,
}: {
  readonly accessibilityId: string;
  readonly className: string | undefined;
  readonly density: GanttDensity;
  readonly interaction: GanttInteractionState;
  readonly overlayContainer: GanttOverlayContainer | undefined;
  readonly rootRef: RefObject<HTMLDivElement | null>;
  readonly slots: GanttProps['slots'] | undefined;
  readonly themeId: string;
  readonly themeMode: GanttBuiltInTheme;
  readonly themeRevision: string;
}): OverlayController {
  const boundary: OverlayBoundary = overlayContainer === 'root' ? 'root' : 'viewport';
  const boundaryRef = useRef(boundary);
  boundaryRef.current = boundary;
  const [localHost, setLocalHost] = useState<HTMLDivElement | null>(null);
  const [externalHost, setExternalHost] = useState<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TaskOverlayPosition | undefined>();
  const [menu, setMenu] = useState<TaskOverlayPosition | undefined>();
  const [editor, setEditor] = useState<EditorOverlay | undefined>();
  const stateRef = useRef({ editor, menu, tooltip });
  stateRef.current = { editor, menu, tooltip };
  const tooltipSurfaceRef = useRef<HTMLDivElement | null>(null);
  const menuSurfaceRef = useRef<HTMLDivElement | null>(null);
  const editorSurfaceRef = useRef<HTMLDivElement | null>(null);
  const host = boundary === 'root' ? localHost : externalHost;
  const tooltipId = `${accessibilityId}-tooltip`;
  const menuId = `${accessibilityId}-context-menu`;
  const editorId = `${accessibilityId}-editor`;
  const editorErrorId = `${accessibilityId}-editor-error`;

  const focusElement = useCallback(
    (selector: string, key: string, datasetKey: 'dependencyId' | 'viewKey') => {
      queueMicrotask(() => {
        const root = rootRef.current;
        const element = Array.from(root?.querySelectorAll<HTMLElement>(selector) ?? []).find(
          (candidate) => candidate.dataset[datasetKey] === key,
        );
        (element ?? root)?.focus();
      });
    },
    [rootRef],
  );
  const closeMenu = useCallback(
    (restoreFocus = true) => {
      const viewKey = stateRef.current.menu?.viewKey;
      setMenu(undefined);
      if (restoreFocus && viewKey !== undefined) {
        focusElement('[data-gt-part="task"]', viewKey, 'viewKey');
      }
    },
    [focusElement],
  );
  const closeEditor = useCallback(
    (restoreFocus = true) => {
      const current = stateRef.current.editor;
      setEditor(undefined);
      if (!restoreFocus || current === undefined) return;
      if (current.kind === 'lane') {
        focusElement('[data-gt-part="lane-properties-trigger"]', current.viewKey, 'viewKey');
      } else if (current.kind === 'dependency') {
        focusElement('[data-gt-part="dependency"]', current.viewKey, 'dependencyId');
      } else {
        focusElement('[data-gt-part="task"]', current.viewKey, 'viewKey');
      }
    },
    [focusElement],
  );
  const position = useCallback(
    (viewKey: string, element: Element, clientX?: number, clientY?: number) => {
      const rootRect = rootRef.current?.getBoundingClientRect();
      const taskRect = element.getBoundingClientRect();
      const rootLeft = boundaryRef.current === 'root' ? (rootRect?.left ?? 0) : 0;
      const rootTop = boundaryRef.current === 'root' ? (rootRect?.top ?? 0) : 0;
      return {
        viewKey,
        x: Math.max(OVERLAY_SAFE_AREA, (clientX ?? taskRect.left + taskRect.width / 2) - rootLeft),
        y: Math.max(OVERLAY_SAFE_AREA, (clientY ?? taskRect.bottom + 6) - rootTop),
      };
    },
    [rootRef],
  );
  const showTooltip = useCallback(
    (enabled: boolean, viewKey: string, element: Element) => {
      const current = stateRef.current;
      if (enabled && current.menu === undefined && current.editor === undefined) {
        setTooltip(position(viewKey, element));
      }
    },
    [position],
  );

  useLayoutEffect(() => {
    if (boundary === 'root') {
      setExternalHost(null);
      return;
    }
    const root = rootRef.current;
    if (root === null) return;
    const target = resolveOverlayTarget(overlayContainer, root);
    if (target === null) {
      setExternalHost(null);
      return;
    }
    const nextHost = root.ownerDocument.createElement('div');
    nextHost.className = 'gt-gantt gt-gantt__overlays gt-gantt__overlays--viewport';
    nextHost.dataset.gantempo = '';
    nextHost.dataset.gtOverlayBoundary = 'viewport';
    nextHost.dataset.gtOverlayOwner = accessibilityId;
    nextHost.dataset.gtPart = 'overlay-host';
    target.append(nextHost);
    syncOverlayTheme(root, nextHost);
    setExternalHost(nextHost);
    return () => {
      setExternalHost((current) => (current === nextHost ? null : current));
      nextHost.remove();
    };
  }, [accessibilityId, boundary, overlayContainer, rootRef]);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root !== null && externalHost !== null) {
      syncOverlayThemeAttributes(externalHost, density, themeId, themeMode);
      syncOverlayTheme(root, externalHost);
    }
  }, [className, density, externalHost, rootRef, themeId, themeMode, themeRevision]);

  useEffect(() => {
    if (menu === undefined) return;
    const ownerDocument = menuSurfaceRef.current?.ownerDocument ?? rootRef.current?.ownerDocument;
    if (ownerDocument === undefined) return;
    const dismiss = (event: PointerEvent) => {
      if (
        event.target !== null &&
        menuSurfaceRef.current !== null &&
        !menuSurfaceRef.current.contains(event.target as Node)
      ) {
        closeMenu();
      }
    };
    ownerDocument.addEventListener('pointerdown', dismiss);
    return () => ownerDocument.removeEventListener('pointerdown', dismiss);
  }, [closeMenu, menu, rootRef]);
  useEffect(() => {
    if (menu === undefined && tooltip === undefined) return;
    const ownerDocument = rootRef.current?.ownerDocument;
    const view = ownerDocument?.defaultView;
    if (ownerDocument === undefined || view === null || view === undefined) return;
    const dismiss = () => {
      setTooltip(undefined);
      if (menu !== undefined) closeMenu();
    };
    ownerDocument.addEventListener('scroll', dismiss, true);
    view.addEventListener('resize', dismiss);
    return () => {
      ownerDocument.removeEventListener('scroll', dismiss, true);
      view.removeEventListener('resize', dismiss);
    };
  }, [closeMenu, menu, rootRef, tooltip]);
  useLayoutEffect(() => {
    if (
      tooltip === undefined ||
      tooltip.adjusted === true ||
      tooltipSurfaceRef.current === null ||
      host === null
    ) {
      return;
    }
    const adjusted = adjustedOverlayPosition(tooltip, tooltipSurfaceRef.current, host, boundary);
    if (adjusted.x !== tooltip.x || adjusted.y !== tooltip.y) setTooltip(adjusted);
  }, [boundary, host, tooltip]);
  useLayoutEffect(() => {
    if (
      menu === undefined ||
      menu.adjusted === true ||
      menuSurfaceRef.current === null ||
      host === null
    ) {
      return;
    }
    const adjusted = adjustedOverlayPosition(menu, menuSurfaceRef.current, host, boundary);
    if (adjusted.x !== menu.x || adjusted.y !== menu.y) setMenu(adjusted);
  }, [boundary, host, menu]);
  useLayoutEffect(() => {
    if (menu !== undefined) {
      const first = menuSurfaceRef.current?.querySelector<HTMLElement>(
        '[role="menuitem"]:not([disabled])',
      );
      (first ?? menuSurfaceRef.current)?.focus();
    }
  }, [menu]);
  useLayoutEffect(() => {
    if (editor !== undefined) {
      const first =
        editorSurfaceRef.current?.querySelector<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
        ) ?? editorSurfaceRef.current?.querySelector<HTMLElement>('button:not([disabled])');
      (first ?? editorSurfaceRef.current)?.focus();
    }
  }, [editor?.viewKey]);
  useLayoutEffect(() => {
    if (editor === undefined || boundary !== 'viewport' || host === null) return;
    const ownerDocument = host.ownerDocument;
    const body = ownerDocument.body;
    if (host.parentElement !== body) return;
    const previous = new Map<
      Element,
      { readonly ariaHidden: string | null; readonly inert: boolean }
    >();
    const isolate = (element: Element) => {
      if (element === host || previous.has(element)) return;
      previous.set(element, {
        ariaHidden: element.getAttribute('aria-hidden'),
        inert: element.hasAttribute('inert'),
      });
      element.setAttribute('aria-hidden', 'true');
      element.setAttribute('inert', '');
    };
    for (const element of body.children) isolate(element);
    const Observer = ownerDocument.defaultView?.MutationObserver;
    const observer =
      Observer === undefined
        ? undefined
        : new Observer((records) => {
            for (const record of records) {
              for (const node of record.addedNodes) {
                if (node.nodeType === 1) isolate(node as Element);
              }
            }
          });
    observer?.observe(body, { childList: true });
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const view = ownerDocument.defaultView;
    const scrollbarWidth =
      view === null ? 0 : Math.max(0, view.innerWidth - ownerDocument.documentElement.clientWidth);
    const computedPadding =
      view === null ? 0 : Number.parseFloat(view.getComputedStyle(body).paddingRight) || 0;
    body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) body.style.paddingRight = `${computedPadding + scrollbarWidth}px`;
    return () => {
      observer?.disconnect();
      for (const [element, value] of previous) {
        if (value.ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', value.ariaHidden);
        element.toggleAttribute('inert', value.inert);
      }
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, [boundary, editor, host]);
  useLayoutEffect(() => {
    if (!DEVELOPMENT) return;
    if (
      tooltip !== undefined &&
      slots?.Tooltip !== undefined &&
      tooltipSurfaceRef.current === null
    ) {
      console.warn('Gantt Tooltip slot must spread the provided bindings onto its owning element.');
    }
    if (menu !== undefined && slots?.ContextMenu !== undefined && menuSurfaceRef.current === null) {
      console.warn(
        'Gantt ContextMenu slot must spread the provided bindings onto its owning element.',
      );
    }
    if (
      editor?.mode === 'legacy' &&
      slots?.TaskEditor !== undefined &&
      editorSurfaceRef.current === null
    ) {
      console.warn(
        'Gantt TaskEditor slot must spread the provided bindings onto its owning element.',
      );
    }
    if (
      editor?.mode === 'properties' &&
      slots?.ItemProperties !== undefined &&
      editorSurfaceRef.current === null
    ) {
      console.warn(
        'Gantt ItemProperties slot must spread the provided bindings onto its owning element.',
      );
    }
  }, [editor, menu, slots, tooltip]);
  useEffect(() => {
    if (editor?.pending !== true) return;
    if (interaction.status === 'rejected') {
      setEditor((current) =>
        current === undefined
          ? undefined
          : { ...current, error: interaction.announcement, pending: false },
      );
    } else if (interaction.status === 'idle') {
      closeEditor();
    }
  }, [closeEditor, editor?.pending, interaction]);

  return {
    boundary,
    closeEditor,
    closeMenu,
    editor,
    editorErrorId,
    editorId,
    editorSurfaceRef,
    host,
    menu,
    menuId,
    menuSurfaceRef,
    position,
    setEditor,
    setLocalHost,
    setMenu,
    setTooltip,
    showTooltip,
    tooltip,
    tooltipId,
    tooltipSurfaceRef,
  };
}
