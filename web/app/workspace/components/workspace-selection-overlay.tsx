'use client';

import { PointerEvent, useCallback, useRef, useState } from 'react';
import { WorkspaceSelection } from '@/lib/workspace-storage';
import { useWorkspaceProject } from '../hooks/use-workspace-project';

type DragMode =
  | { type: 'none' }
  | { type: 'drawing'; originX: number; originY: number }
  | { type: 'move'; startX: number; startY: number; initial: WorkspaceSelection }
  | { type: 'resize'; handle: ResizeHandle; initial: WorkspaceSelection };

type ResizeHandle = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'bottom' | 'left' | 'right';

const MIN_SIZE = 20;

export function WorkspaceSelectionOverlay() {
  const { project, updateSelection } = useWorkspaceProject();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragMode>({ type: 'none' });

  const getRelativePoint = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) {
      return { x: 0, y: 0 };
    }
    const x = Math.min(Math.max(0, event.clientX - rect.left), rect.width);
    const y = Math.min(Math.max(0, event.clientY - rect.top), rect.height);
    return { x, y };
  }, []);

  const normalizeSelection = (startX: number, startY: number, x: number, y: number): WorkspaceSelection => {
    const left = Math.min(startX, x);
    const top = Math.min(startY, y);
    const width = Math.abs(x - startX);
    const height = Math.abs(y - startY);
    return {
      x: left,
      y: top,
      width,
      height,
      ratio: 'custom',
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const { x, y } = getRelativePoint(event);
    setDragState({ type: 'drawing', originX: x, originY: y });
    updateSelection({
      x,
      y,
      width: 0,
      height: 0,
      ratio: 'custom',
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragState.type === 'none') return;
    event.preventDefault();
    const { x, y } = getRelativePoint(event);
    if (dragState.type === 'drawing') {
      const selection = normalizeSelection(dragState.originX, dragState.originY, x, y);
      updateSelection(selection);
    } else if (dragState.type === 'move' && project.selection) {
      const deltaX = x - dragState.startX;
      const deltaY = y - dragState.startY;
      const next: WorkspaceSelection = {
        ...dragState.initial,
        x: Math.min(Math.max(0, dragState.initial.x + deltaX), (overlayRef.current?.clientWidth ?? 0) - dragState.initial.width),
        y: Math.min(Math.max(0, dragState.initial.y + deltaY), (overlayRef.current?.clientHeight ?? 0) - dragState.initial.height),
      };
      updateSelection(next);
    } else if (dragState.type === 'resize' && project.selection) {
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return;
      const relativeX = x;
      const relativeY = y;
      const { handle, initial } = dragState;
      let nextX = initial.x;
      let nextY = initial.y;
      let nextWidth = initial.width;
      let nextHeight = initial.height;

      if (handle.includes('left')) {
        const newLeft = Math.min(relativeX, initial.x + initial.width - MIN_SIZE);
        nextWidth = initial.x + initial.width - newLeft;
        nextX = newLeft;
      }
      if (handle.includes('right')) {
        const newRight = Math.max(relativeX, initial.x + MIN_SIZE);
        nextWidth = Math.min(newRight - initial.x, rect.width - initial.x);
      }
      if (handle.includes('top')) {
        const newTop = Math.min(relativeY, initial.y + initial.height - MIN_SIZE);
        nextHeight = initial.y + initial.height - newTop;
        nextY = newTop;
      }
      if (handle.includes('bottom')) {
        const newBottom = Math.max(relativeY, initial.y + MIN_SIZE);
        nextHeight = Math.min(newBottom - initial.y, rect.height - initial.y);
      }

      updateSelection({
        x: nextX,
        y: nextY,
        width: Math.max(MIN_SIZE, nextWidth),
        height: Math.max(MIN_SIZE, nextHeight),
        ratio: 'custom',
      });
    }
  };

  const handlePointerUp = () => {
    if (dragState.type === 'drawing' && project.selection) {
      const { width, height } = project.selection;
      if (width < MIN_SIZE || height < MIN_SIZE) {
        updateSelection(undefined);
      }
    }
    setDragState({ type: 'none' });
  };

  const startMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !project.selection) return;
    event.stopPropagation();
    const { x, y } = getRelativePoint(event);
    setDragState({
      type: 'move',
      startX: x,
      startY: y,
      initial: project.selection,
    });
  };

  const startResize = (event: PointerEvent<HTMLDivElement>, handle: ResizeHandle) => {
    if (event.button !== 0 || !project.selection) return;
    event.stopPropagation();
    setDragState({
      type: 'resize',
      handle,
      initial: project.selection,
    });
  };

  const selection = project.selection;

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 cursor-crosshair"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {selection && (
        <div
          className="group absolute rounded-xl border border-red-500/70 bg-white/40 shadow-[0_0_0_1px_rgba(248,113,113,0.4)]"
          style={{ left: selection.x, top: selection.y, width: selection.width, height: selection.height }}
        >
          <div
            className="absolute inset-0 cursor-move"
            onPointerDown={startMove}
          />
          <div className="absolute -top-8 left-0 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow">
            {Math.round(selection.width)}px × {Math.round(selection.height)}px
          </div>
          {renderHandles(startResize)}
        </div>
      )}
    </div>
  );
}

const handles: Array<{ handle: ResizeHandle; className: string }> = [
  { handle: 'top-left', className: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize' },
  { handle: 'top-right', className: 'right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize' },
  { handle: 'bottom-left', className: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize' },
  { handle: 'bottom-right', className: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize' },
  { handle: 'top', className: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize' },
  { handle: 'bottom', className: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize' },
  { handle: 'left', className: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize' },
  { handle: 'right', className: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize' },
];

function renderHandles(startResize: (event: PointerEvent<HTMLDivElement>, handle: ResizeHandle) => void) {
  return handles.map(({ handle, className }) => (
    <div
      key={handle}
      className={`absolute h-3 w-3 rounded-full border border-white bg-red-600 shadow ${className}`}
      onPointerDown={(event) => startResize(event, handle)}
    />
  ));
}
