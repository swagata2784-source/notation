import React, { useEffect, useRef } from 'react';
import { Measure } from '../../types/score';
import {
  PlusCircle,
  Copy,
  Trash2,
  RotateCcw,
  Sparkles,
  Scissors,
  Clipboard,
  Maximize2,
  Repeat,
  CornerDownLeft,
  MoveVertical,
} from 'lucide-react';

interface MeasureContextMenuProps {
  measure: Measure;
  x: number;
  y: number;
  onClose: () => void;
  onAddBefore: (measureId: string) => void;
  onAddAfter: (measureId: string) => void;
  onDuplicate: (measureId: string) => void;
  onDelete: (measureId: string) => void;
  onClear: (measureId: string) => void;
  onResetWidth: (measureId: string) => void;
  onOpenNavigation?: (measure: Measure) => void;
  onToggleLineBreak?: (measureId: string) => void;
  onAddSpaceBelow?: (measureId: string) => void;
  onCopyMeasure?: (measureId: string) => void;
  onPasteIntoMeasure?: (measureId: string) => void;
  hasClipboardContent?: boolean;
}

export const MeasureContextMenu: React.FC<MeasureContextMenuProps> = ({
  measure,
  x,
  y,
  onClose,
  onAddBefore,
  onAddAfter,
  onDuplicate,
  onDelete,
  onClear,
  onResetWidth,
  onOpenNavigation,
  onToggleLineBreak,
  onAddSpaceBelow,
  onCopyMeasure,
  onPasteIntoMeasure,
  hasClipboardContent,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Adjust positioning so it doesn't clip screen boundaries
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 300);

  return (
    <div
      ref={menuRef}
      style={{ left: adjustedX, top: adjustedY }}
      className="fixed z-50 w-52 bg-white border border-stone-200 rounded-xl shadow-xl py-1.5 text-xs text-stone-800 font-sans select-none animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-3 py-1 font-serif text-[11px] font-bold text-stone-500 uppercase border-b border-stone-100 mb-1">
        Measure {measure.measureNumber}
      </div>

      <button
        onClick={() => {
          onAddBefore(measure.id);
          onClose();
        }}
        className="w-full px-3 py-1.5 text-left hover:bg-stone-50 flex items-center space-x-2"
      >
        <PlusCircle className="w-3.5 h-3.5 text-stone-500" />
        <span>Add Measure Before</span>
      </button>

      <button
        onClick={() => {
          onAddAfter(measure.id);
          onClose();
        }}
        className="w-full px-3 py-1.5 text-left hover:bg-stone-50 flex items-center space-x-2"
      >
        <PlusCircle className="w-3.5 h-3.5 text-stone-500" />
        <span>Add Measure After</span>
      </button>

      <button
        onClick={() => {
          onDuplicate(measure.id);
          onClose();
        }}
        className="w-full px-3 py-1.5 text-left hover:bg-stone-50 flex items-center space-x-2"
      >
        <Copy className="w-3.5 h-3.5 text-stone-500" />
        <span>Duplicate Measure</span>
      </button>

      {/* Copy Measure */}
      {onCopyMeasure && (
        <button
          onClick={() => {
            onCopyMeasure(measure.id);
            onClose();
          }}
          className="w-full px-3 py-1.5 text-left hover:bg-stone-50 flex items-center justify-between text-stone-800"
        >
          <span className="flex items-center space-x-2">
            <Copy className="w-3.5 h-3.5 text-stone-500" />
            <span>Copy Measure</span>
          </span>
          <span className="text-[10px] text-stone-400 font-mono">Ctrl+C</span>
        </button>
      )}

      {/* Paste into Measure */}
      {onPasteIntoMeasure && (
        <button
          onClick={() => {
            onPasteIntoMeasure(measure.id);
            onClose();
          }}
          disabled={!hasClipboardContent}
          className="w-full px-3 py-1.5 text-left hover:bg-stone-50 flex items-center justify-between text-stone-800 disabled:opacity-35"
        >
          <span className="flex items-center space-x-2">
            <Clipboard className="w-3.5 h-3.5 text-stone-500" />
            <span>Paste Here</span>
          </span>
          <span className="text-[10px] text-stone-400 font-mono">Ctrl+V</span>
        </button>
      )}

      {/* Insert Space Below */}
      {onAddSpaceBelow && (
        <button
          onClick={() => {
            onAddSpaceBelow(measure.id);
            onClose();
          }}
          className="w-full px-3 py-1.5 text-left hover:bg-sky-50 flex items-center justify-between text-stone-800"
        >
          <span className="flex items-center space-x-2 text-sky-900 font-medium">
            <MoveVertical className="w-3.5 h-3.5 text-sky-600" />
            <span>Add Vertical Space Below</span>
          </span>
          <span className="text-[10px] text-sky-600 font-mono">↕</span>
        </button>
      )}

      {/* Repeat & Navigation */}
      <button
        onClick={() => {
          onOpenNavigation?.(measure);
          onClose();
        }}
        className="w-full px-3 py-1.5 text-left hover:bg-amber-50 flex items-center space-x-2 text-stone-800"
      >
        <Repeat className="w-3.5 h-3.5 text-amber-600" />
        <span className="font-medium">Repeat & Navigation...</span>
      </button>

      {/* Manual Line Break */}
      <button
        onClick={() => {
          onToggleLineBreak?.(measure.id);
          onClose();
        }}
        className="w-full px-3 py-1.5 text-left hover:bg-stone-50 flex items-center justify-between text-stone-800"
      >
        <span className="flex items-center space-x-2">
          <CornerDownLeft className="w-3.5 h-3.5 text-stone-500" />
          <span>{measure.systemBreak ? 'Remove Line Break' : 'Line Break After Bar'}</span>
        </span>
        <span className="text-[10px] text-stone-400 font-mono">↵</span>
      </button>

      <div className="my-1 border-t border-stone-100" />

      <button
        onClick={() => {
          onClear(measure.id);
          onClose();
        }}
        className="w-full px-3 py-1.5 text-left hover:bg-stone-50 flex items-center space-x-2 text-stone-700"
      >
        <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
        <span>Clear Measure Events</span>
      </button>

      <button
        onClick={() => {
          onResetWidth(measure.id);
          onClose();
        }}
        className="w-full px-3 py-1.5 text-left hover:bg-stone-50 flex items-center space-x-2 text-stone-700"
      >
        <Maximize2 className="w-3.5 h-3.5 text-stone-500" />
        <span>Reset Width (Auto)</span>
      </button>

      <div className="my-1 border-t border-stone-100" />

      <button
        onClick={() => {
          onDelete(measure.id);
          onClose();
        }}
        className="w-full px-3 py-1.5 text-left hover:bg-red-50 flex items-center space-x-2 text-red-600 font-medium"
      >
        <Trash2 className="w-3.5 h-3.5 text-red-600" />
        <span>Delete Measure</span>
      </button>
    </div>
  );
};
