import React, { useState, useEffect, useRef } from 'react';
import { ScoreTextAnnotation } from '../../types/score';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Trash2, X, Move } from 'lucide-react';

interface TextAnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveText: (textData: Partial<ScoreTextAnnotation>) => void;
  onDeleteText?: (id: string) => void;
  initialData?: Partial<ScoreTextAnnotation> | null;
  targetMeasureNumber?: number;
  targetBeatNumber?: number;
}

const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48];
const PRESET_TEXTS = [
  'Intro',
  'Verse 1',
  'Verse 2',
  'Chorus',
  'Bridge',
  'Outro',
  'Play softly',
  'Slowly',
  'Allegro',
  'Fine',
  'Da Capo',
  'Dal Segno',
  'Coda',
];

const PRESET_COLORS = [
  { label: 'Print Black', value: '#0f172a' },
  { label: 'Slate Gray', value: '#475569' },
  { label: 'Crimson', value: '#b91c1c' },
  { label: 'Navy Blue', value: '#1d4ed8' },
  { label: 'Forest Green', value: '#047857' },
  { label: 'Purple', value: '#7e22ce' },
];

export const TextAnnotationModal: React.FC<TextAnnotationModalProps> = ({
  isOpen,
  onClose,
  onSaveText,
  onDeleteText,
  initialData,
  targetMeasureNumber,
  targetBeatNumber,
}) => {
  const [text, setText] = useState('');
  const [pageIndex, setPageIndex] = useState<number>(0);
  const [x, setX] = useState<number>(120);
  const [y, setY] = useState<number>(120);
  const [fontSize, setFontSize] = useState<number>(14);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [color, setColor] = useState('#0f172a');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setText(initialData.text || initialData.content || '');
        setPageIndex(initialData.pageIndex !== undefined ? initialData.pageIndex : 0);
        setX(initialData.x !== undefined ? initialData.x : 120);
        setY(initialData.y !== undefined ? initialData.y : 120);
        setFontSize(initialData.fontSize || 14);
        setIsBold(initialData.fontWeight === 'bold');
        setIsItalic(initialData.fontStyle === 'italic');
        setIsUnderline(initialData.textDecoration === 'underline');
        setTextAlign(initialData.textAlign || 'left');
        setColor(initialData.color || '#0f172a');
      } else {
        setText('');
        setPageIndex(0);
        setX(120);
        setY(120);
        setFontSize(14);
        setIsBold(false);
        setIsItalic(false);
        setIsUnderline(false);
        setTextAlign('left');
        setColor('#0f172a');
      }

      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 60);
      return () => clearTimeout(t);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim()) return;

    onSaveText({
      ...(initialData || {}),
      id: initialData?.id,
      type: 'text',
      text: text.trim(),
      content: text.trim(),
      pageIndex,
      x: Math.round(x),
      y: Math.round(y),
      fontSize,
      fontWeight: isBold ? 'bold' : 'normal',
      fontStyle: isItalic ? 'italic' : 'normal',
      textDecoration: isUnderline ? 'underline' : 'none',
      textAlign,
      color,
    });
    onClose();
  };

  const isEditing = Boolean(initialData?.id);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-2xs p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="text-annotation-modal"
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-stone-50 border-b border-stone-200">
          <div>
            <h3 className="font-semibold text-stone-900 text-sm">
              {isEditing ? 'Edit Text Object' : 'Add Independent Text to Page'}
            </h3>
            <p className="text-[11px] text-stone-500">
              A4 Page {pageIndex + 1} • Unlimited free-placement text object
              {targetMeasureNumber ? ` (near Bar ${targetMeasureNumber})` : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Text Input */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Text Content
            </label>
            <input
              ref={inputRef}
              id="score-text-input"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Play softly, Allegro, Verse 1, Fine, Expressive..."
              className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 font-sans"
            />
          </div>

          {/* Quick Presets */}
          <div>
            <label className="block text-[11px] font-medium text-stone-500 mb-1.5">
              Quick Suggestions
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_TEXTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setText(preset)}
                  className="px-2 py-0.5 text-[11px] bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-md border border-stone-200/80 transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Position Row: Page, X, Y */}
          <div className="bg-stone-50/80 p-3 rounded-lg border border-stone-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-stone-700 flex items-center gap-1">
                <Move className="w-3.5 h-3.5 text-stone-500" /> Page Position (px)
              </span>
              <span className="text-[10px] text-stone-500">Drag directly on score to move freely</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <label className="block text-[10px] text-stone-500 mb-0.5 font-medium">Page</label>
                <select
                  value={pageIndex}
                  onChange={(e) => setPageIndex(Number(e.target.value))}
                  className="w-full px-2 py-1 bg-white border border-stone-300 rounded text-xs"
                >
                  <option value={0}>Page 1</option>
                  <option value={1}>Page 2</option>
                  <option value={2}>Page 3</option>
                  <option value={3}>Page 4</option>
                  <option value={4}>Page 5</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-stone-500 mb-0.5 font-medium">X (Horizontal)</label>
                <input
                  type="number"
                  min="10"
                  max="1200"
                  value={x}
                  onChange={(e) => setX(Number(e.target.value) || 0)}
                  className="w-full px-2 py-1 bg-white border border-stone-300 rounded text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] text-stone-500 mb-0.5 font-medium">Y (Vertical)</label>
                <input
                  type="number"
                  min="10"
                  max="1600"
                  value={y}
                  onChange={(e) => setY(Number(e.target.value) || 0)}
                  className="w-full px-2 py-1 bg-white border border-stone-300 rounded text-xs"
                />
              </div>
            </div>
          </div>

          {/* Formatting Row: Size & Styles */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* Font Size */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Font Size
              </label>
              <div className="flex items-center space-x-1">
                <select
                  id="score-text-font-size"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="flex-1 px-2.5 py-1.5 text-xs border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 bg-white"
                >
                  {FONT_SIZES.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz} px {sz === 14 ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="8"
                  max="72"
                  value={fontSize}
                  onChange={(e) => setFontSize(Math.max(8, Math.min(72, Number(e.target.value) || 14)))}
                  className="w-14 px-1.5 py-1.5 text-xs text-center border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  title="Custom Size (px)"
                />
              </div>
            </div>

            {/* Colors */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Color
              </label>
              <div className="flex items-center space-x-1.5 pt-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    title={c.label}
                    className={`w-6 h-6 rounded-full border transition-transform ${
                      color === c.value
                        ? 'scale-110 ring-2 ring-blue-500 border-white shadow-xs'
                        : 'border-stone-300 hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-6 h-6 p-0 border border-stone-300 rounded cursor-pointer"
                  title="Custom color"
                />
              </div>
            </div>
          </div>

          {/* Style Toggles & Alignment */}
          <div className="flex items-center justify-between pt-1">
            {/* Bold, Italic, Underline */}
            <div className="flex items-center space-x-1 bg-stone-100 p-1 rounded-lg border border-stone-200">
              <button
                type="button"
                onClick={() => setIsBold(!isBold)}
                title="Bold"
                className={`p-1.5 rounded-md transition-colors ${
                  isBold ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsItalic(!isItalic)}
                title="Italic"
                className={`p-1.5 rounded-md transition-colors ${
                  isItalic ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsUnderline(!isUnderline)}
                title="Underline"
                className={`p-1.5 rounded-md transition-colors ${
                  isUnderline ? 'bg-white text-stone-900 shadow-xs font-bold' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Text Alignment */}
            <div className="flex items-center space-x-1 bg-stone-100 p-1 rounded-lg border border-stone-200">
              <button
                type="button"
                onClick={() => setTextAlign('left')}
                title="Align Left"
                className={`p-1.5 rounded-md transition-colors ${
                  textAlign === 'left' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTextAlign('center')}
                title="Align Center"
                className={`p-1.5 rounded-md transition-colors ${
                  textAlign === 'center' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setTextAlign('right')}
                title="Align Right"
                className={`p-1.5 rounded-md transition-colors ${
                  textAlign === 'right' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
            <div className="text-[10px] text-stone-400 uppercase font-bold tracking-wider mb-1">Preview</div>
            <div
              className="truncate"
              style={{
                fontSize: `${fontSize}px`,
                fontWeight: isBold ? 'bold' : 'normal',
                fontStyle: isItalic ? 'italic' : 'normal',
                textDecoration: isUnderline ? 'underline' : 'none',
                textAlign,
                color,
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              {text || 'Preview text...'}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-stone-200">
            {isEditing && onDeleteText && initialData?.id ? (
              <button
                type="button"
                id="btn-delete-score-text"
                onClick={() => {
                  onDeleteText(initialData.id!);
                  onClose();
                }}
                className="flex items-center space-x-1 px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="btn-confirm-score-text"
                disabled={!text.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-xs transition-colors"
              >
                {isEditing ? 'Save Changes' : 'Add Text'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
