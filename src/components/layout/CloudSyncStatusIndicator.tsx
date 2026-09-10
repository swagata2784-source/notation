import React, { useState } from 'react';
import {
  Cloud,
  CloudCheck,
  CloudOff,
  RefreshCw,
  AlertCircle,
  Check,
  WifiOff,
} from 'lucide-react';

export type CloudSyncState =
  | 'loading'
  | 'unsaved'
  | 'saving'
  | 'saved'
  | 'offline'
  | 'error';

interface CloudSyncStatusIndicatorProps {
  status: CloudSyncState;
  lastSavedAt: Date | null;
  errorMessage?: string | null;
  onRetry?: () => void;
  onOpenCloudSettings?: () => void;
  className?: string;
}

export const CloudSyncStatusIndicator: React.FC<CloudSyncStatusIndicatorProps> = ({
  status,
  lastSavedAt,
  errorMessage,
  onRetry,
  onOpenCloudSettings,
  className = '',
}) => {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  // Format last saved time
  const formatTime = (date: Date | null) => {
    if (!date) return 'Not yet saved';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 60000) return 'Just now';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getTooltipContent = () => {
    switch (status) {
      case 'loading':
        return {
          title: 'Opening Project',
          description: 'Loading score data from the cloud...',
        };
      case 'unsaved':
        return {
          title: 'Unsaved Changes',
          description: 'Your changes are pending sync. Cloud autosave will trigger shortly.',
        };
      case 'saving':
        return {
          title: 'Saving to Cloud',
          description: 'Synchronizing your latest score changes with cloud storage...',
        };
      case 'saved':
        return {
          title: 'All Changes Saved',
          description: `Score is safely saved in the cloud. Last synced: ${formatTime(lastSavedAt)}`,
        };
      case 'offline':
        return {
          title: 'Working Offline',
          description: 'No internet connection detected. Changes are stored locally and will sync automatically when back online.',
        };
      case 'error':
        return {
          title: 'Cloud Sync Failed',
          description: errorMessage || 'Could not reach cloud storage. Click Retry to synchronize your changes.',
        };
    }
  };

  const tooltip = getTooltipContent();

  return (
    <div
      className={`relative inline-flex items-center font-sans ${className}`}
      onMouseEnter={() => setIsTooltipOpen(true)}
      onMouseLeave={() => setIsTooltipOpen(false)}
    >
      {/* Visual Status Button / Pill */}
      {status === 'saved' && (
        <button
          type="button"
          id="cloud-sync-status-btn"
          onClick={onOpenCloudSettings}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50/90 border border-emerald-300/80 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer select-none"
          title="All changes saved to cloud"
        >
          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
          <span className="hidden sm:inline">Saved</span>
        </button>
      )}

      {status === 'saving' && (
        <div
          id="cloud-sync-status-btn"
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-amber-900 bg-amber-50/90 border border-amber-300/80 shadow-2xs select-none animate-pulse"
          title="Saving latest changes..."
        >
          <RefreshCw className="w-3.5 h-3.5 text-amber-700 animate-spin" />
          <span className="hidden sm:inline font-sans">Saving…</span>
        </div>
      )}

      {status === 'unsaved' && (
        <div
          id="cloud-sync-status-btn"
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-stone-700 bg-stone-100 border border-stone-300 shadow-2xs select-none"
          title="Unsaved changes pending sync"
        >
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <span className="hidden sm:inline">Unsaved</span>
        </div>
      )}

      {status === 'loading' && (
        <div
          id="cloud-sync-status-btn"
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-stone-600 bg-stone-50 border border-stone-200 shadow-2xs select-none"
          title="Loading cloud project..."
        >
          <RefreshCw className="w-3.5 h-3.5 text-stone-500 animate-spin" />
          <span className="hidden sm:inline">Loading…</span>
        </div>
      )}

      {status === 'offline' && (
        <div
          id="cloud-sync-status-btn"
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-stone-600 bg-stone-100 border border-stone-300 shadow-2xs select-none"
          title="Offline — changes will sync when online"
        >
          <CloudOff className="w-3.5 h-3.5 text-stone-500" />
          <span className="hidden sm:inline">Offline</span>
        </div>
      )}

      {status === 'error' && (
        <button
          type="button"
          id="cloud-sync-status-btn"
          onClick={onRetry}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-800 bg-red-50 border border-red-300 hover:bg-red-100 transition-colors shadow-2xs cursor-pointer select-none"
          title="Cloud sync failed. Click to retry."
        >
          <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
          <span className="font-medium">
            Sync failed <span className="font-bold underline ml-0.5">· Retry</span>
          </span>
        </button>
      )}

      {/* Popover / Tooltip */}
      {isTooltipOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-white rounded-xl shadow-xl border border-stone-200 text-stone-800 text-xs z-50 animate-in fade-in zoom-in-95 duration-100 font-sans pointer-events-none">
          <div className="flex items-start space-x-2">
            <div className="p-1 rounded-md bg-stone-100 shrink-0 mt-0.5">
              {status === 'saved' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
              {status === 'saving' && <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />}
              {status === 'unsaved' && <Cloud className="w-3.5 h-3.5 text-amber-600" />}
              {status === 'loading' && <RefreshCw className="w-3.5 h-3.5 text-stone-600 animate-spin" />}
              {status === 'offline' && <CloudOff className="w-3.5 h-3.5 text-stone-600" />}
              {status === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-600" />}
            </div>
            <div className="space-y-1 flex-1">
              <div className="font-bold text-stone-900 text-xs">{tooltip.title}</div>
              <div className="text-stone-500 text-[11px] leading-relaxed">
                {tooltip.description}
              </div>
              {lastSavedAt && status !== 'saving' && (
                <div className="text-[10px] text-stone-400 pt-1 border-t border-stone-100 font-mono">
                  Last saved: {formatTime(lastSavedAt)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
