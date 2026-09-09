import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';

interface AddMeasuresModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (count: number) => void;
  defaultCount?: number;
}

export const AddMeasuresModal: React.FC<AddMeasuresModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  defaultCount = 4,
}) => {
  const [countStr, setCountStr] = useState<string>(String(defaultCount));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCountStr(String(defaultCount));
      setErrorMessage(null);
      // Automatically focus and select the input for rapid entry
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 50);
    }
  }, [isOpen, defaultCount]);

  if (!isOpen) return null;

  const validate = (valStr: string): number | null => {
    const trimmed = valStr.trim();
    if (!trimmed) {
      setErrorMessage('Enter a whole number greater than 0.');
      return null;
    }
    // Must be positive whole integer
    const num = Number(trimmed);
    if (
      isNaN(num) ||
      !Number.isInteger(num) ||
      num <= 0 ||
      !/^\d+$/.test(trimmed)
    ) {
      setErrorMessage('Enter a whole number greater than 0.');
      return null;
    }
    setErrorMessage(null);
    return num;
  };

  const handleAdd = () => {
    const validCount = validate(countStr);
    if (validCount === null) return;
    onAdd(validCount);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      id="add-measures-modal-backdrop"
      className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-100"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        id="add-measures-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-measures-title"
        className="bg-white rounded-xl shadow-2xl border border-stone-200 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Dialog Header */}
        <div className="px-5 py-3.5 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
            <h3
              id="add-measures-title"
              className="text-sm font-bold text-stone-900 font-serif"
            >
              Add Measures
            </h3>
          </div>
          <button
            id="add-measures-close-btn"
            onClick={onClose}
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dialog Body */}
        <div className="p-5 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="add-measures-input"
              className="block text-xs font-semibold text-stone-700"
            >
              Number of measures:
            </label>
            <input
              id="add-measures-input"
              ref={inputRef}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min="1"
              step="1"
              value={countStr}
              onChange={(e) => {
                setCountStr(e.target.value);
                if (errorMessage) {
                  setErrorMessage(null);
                }
              }}
              onKeyDown={handleKeyDown}
              className={`w-full px-3.5 py-2.5 text-base font-semibold text-stone-900 bg-white border rounded-lg shadow-2xs focus:outline-none transition-colors ${
                errorMessage
                  ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                  : 'border-stone-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-100'
              }`}
              placeholder="e.g. 4"
            />
            {errorMessage && (
              <div
                id="add-measures-error"
                className="flex items-center space-x-1.5 text-xs text-rose-600 font-medium pt-0.5"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Quick preset buttons for convenience */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[11px] text-stone-400 font-medium mr-1">Quick:</span>
            {[1, 2, 4, 8, 12, 16].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => {
                  setCountStr(String(num));
                  setErrorMessage(null);
                  if (inputRef.current) inputRef.current.focus();
                }}
                className={`px-2 py-1 text-xs font-semibold rounded border transition-colors ${
                  countStr === String(num)
                    ? 'bg-amber-100 border-amber-300 text-amber-900'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* Dialog Actions */}
        <div className="px-5 py-3.5 border-t border-stone-100 bg-stone-50/60 flex items-center justify-end space-x-2">
          <button
            id="add-measures-cancel-btn"
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
          >
            Cancel
          </button>
          <button
            id="add-measures-confirm-btn"
            type="button"
            onClick={handleAdd}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-bold shadow-2xs transition-colors flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add</span>
          </button>
        </div>
      </div>
    </div>
  );
};
