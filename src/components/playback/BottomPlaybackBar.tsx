import React, { useState, useEffect } from 'react';
import { Score, TempoBeatUnit } from '../../types/score';
import { audioEngine } from '../../services/audioEngine';
import { midiService, MidiDevice } from '../../services/midiService';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Keyboard,
  Radio,
  Gauge,
  Music,
  Sliders,
  Bell,
  ChevronDown,
  Settings2,
} from 'lucide-react';

interface BottomPlaybackBarProps {
  score: Score;
  onUpdateScoreMetadata: (patch: Partial<Score['metadata']>) => void;
  isVirtualPianoOpen: boolean;
  onToggleVirtualPiano: () => void;
  playbackPosition: { measureIndex: number; beat: number } | null;
  selection?: { measureId?: string; beatIndex?: number; subBeatIndex?: number };
  onOpenMidiModal?: () => void;
}

export const BottomPlaybackBar: React.FC<BottomPlaybackBarProps> = ({
  score,
  onUpdateScoreMetadata,
  isVirtualPianoOpen,
  onToggleVirtualPiano,
  playbackPosition,
  selection,
  onOpenMidiModal,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [metronomeOn, setMetronomeOn] = useState(audioEngine.getMetronome());
  const [metronomeVolume, setMetronomeVolume] = useState(audioEngine.getMetronomeVolume());
  const [accentFirstBeat, setAccentFirstBeat] = useState(audioEngine.getAccentFirstBeat());
  const [showMetronomeSettings, setShowMetronomeSettings] = useState(false);
  const [midiDevices, setMidiDevices] = useState<MidiDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    midiService.getSelectedDeviceId()
  );

  const selectedMeasureIdx = selection?.measureId
    ? score.measures.findIndex((m) => m.id === selection.measureId)
    : -1;

  useEffect(() => {
    audioEngine.setStateCallback((playing) => {
      setIsPlaying(playing);
    });

    // Initialize Web MIDI listeners
    const unsubscribeDevices = midiService.onDevicesChange((devices) => {
      setMidiDevices(devices);
      setSelectedDeviceId(midiService.getSelectedDeviceId());
    });

    return () => {
      unsubscribeDevices();
    };
  }, []);

  const handlePlayPause = () => {
    if (isPlaying) {
      audioEngine.pausePlayback();
    } else {
      let mIdx = 0;
      let bIdx = 0;
      let subIdx = 0;
      if (selection?.measureId) {
        const found = score.measures.findIndex((m) => m.id === selection.measureId);
        if (found !== -1) {
          mIdx = found;
          bIdx = selection.beatIndex !== undefined ? selection.beatIndex : 0;
          subIdx = selection.subBeatIndex !== undefined ? selection.subBeatIndex : 0;
        }
      } else if (playbackPosition) {
        mIdx = playbackPosition.measureIndex;
        bIdx = Math.floor(playbackPosition.beat);
      }
      audioEngine.playScore(score, mIdx, bIdx, subIdx);
    }
  };

  const handleStop = () => {
    audioEngine.stopPlayback();
  };

  const handleToggleMetronome = () => {
    const next = !metronomeOn;
    setMetronomeOn(next);
    audioEngine.setMetronome(next);
  };

  const handleMetronomeVolumeChange = (vol: number) => {
    setMetronomeVolume(vol);
    audioEngine.setMetronomeVolume(vol);
  };

  const handleToggleAccent = () => {
    const next = !accentFirstBeat;
    setAccentFirstBeat(next);
    audioEngine.setAccentFirstBeat(next);
  };

  const handleBpmChange = (newBpm: number) => {
    const clamped = Math.max(40, Math.min(240, newBpm));
    onUpdateScoreMetadata({ tempoBpm: clamped });
  };

  const handleBeatUnitChange = (unit: TempoBeatUnit) => {
    onUpdateScoreMetadata({ tempoBeatUnit: unit });
  };

  return (
    <footer
      id="bottom-playback-bar"
      className="w-full bg-white border-t border-stone-200/90 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs z-20 select-none print:hidden shadow-xs relative"
    >
      {/* Playback Transport Controls */}
      <div className="flex items-center space-x-2">
        <button
          id="play-pause-btn"
          onClick={handlePlayPause}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors shadow-xs ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-stone-900 hover:bg-stone-800 text-white'
          }`}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        <button
          id="stop-btn"
          onClick={handleStop}
          title="Stop"
          className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition-colors"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
        </button>

        {/* Current Position Indicator */}
        <div className="flex items-center space-x-1.5 px-3 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs font-mono">
          <span className="text-stone-500">BAR:</span>
          <span className="font-bold text-stone-900">
            {playbackPosition
              ? playbackPosition.measureIndex + 1
              : selectedMeasureIdx !== -1
              ? selectedMeasureIdx + 1
              : 1}
          </span>
          <span className="text-stone-300">/</span>
          <span className="text-stone-600">{score.measures.length}</span>
          {!isPlaying && selectedMeasureIdx !== -1 && (
            <span className="ml-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-sans font-semibold border border-emerald-200">
              Start: Bar {selectedMeasureIdx + 1}, Beat {(selection?.beatIndex ?? 0) + 1}
              {(selection?.subBeatIndex ?? 0) > 0 ? `.${(selection?.subBeatIndex ?? 0) + 1}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Tempo BPM & Beat Unit Controls */}
      <div className="flex items-center space-x-3 bg-stone-50/80 px-2.5 py-1 rounded-lg border border-stone-200">
        {/* Beat Unit Selector */}
        <div className="flex items-center space-x-0.5 bg-white p-0.5 rounded border border-stone-200">
          <button
            onClick={() => handleBeatUnitChange('quarter')}
            title="Quarter note = BPM"
            className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors ${
              (score.metadata.tempoBeatUnit || 'quarter') === 'quarter'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            ♩
          </button>
          <button
            onClick={() => handleBeatUnitChange('half')}
            title="Half note = BPM"
            className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors ${
              score.metadata.tempoBeatUnit === 'half'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            𝅗𝅥
          </button>
          <button
            onClick={() => handleBeatUnitChange('dotted_quarter')}
            title="Dotted quarter note = BPM"
            className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors ${
              score.metadata.tempoBeatUnit === 'dotted_quarter'
                ? 'bg-stone-900 text-white'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            ♩.
          </button>
        </div>

        <span className="text-stone-500 text-[11px] font-medium">=</span >

        {/* BPM Slider & Manual Input (40 - 240) */}
        <input
          type="range"
          min="40"
          max="240"
          value={score.metadata.tempoBpm}
          onChange={(e) => handleBpmChange(parseInt(e.target.value) || 100)}
          className="w-20 accent-amber-600 cursor-pointer"
        />

        <div className="flex items-center space-x-1">
          <input
            id="tempo-bpm-input"
            type="number"
            min="40"
            max="240"
            value={score.metadata.tempoBpm}
            onChange={(e) => handleBpmChange(parseInt(e.target.value) || 100)}
            className="w-13 px-1.5 py-0.5 border border-stone-300 rounded text-center font-mono font-bold text-xs bg-white focus:ring-1 focus:ring-amber-500"
          />
          <span className="text-[10px] text-stone-500 font-semibold uppercase">BPM</span>
        </div>
      </div>

      {/* Metronome Controls */}
      <div className="relative flex items-center space-x-1.5">
        <button
          id="metronome-btn"
          onClick={handleToggleMetronome}
          title="Toggle Metronome Click"
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
            metronomeOn
              ? 'bg-amber-50 text-amber-900 border-amber-300 font-semibold'
              : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
          }`}
        >
          <Gauge className="w-3.5 h-3.5 text-amber-600" />
          <span>Click: {metronomeOn ? 'ON' : 'OFF'}</span>
        </button>

        {/* Metronome Settings Toggle */}
        <button
          onClick={() => setShowMetronomeSettings(!showMetronomeSettings)}
          title="Metronome volume and accent settings"
          className={`p-1.5 rounded-lg border transition-colors ${
            showMetronomeSettings
              ? 'bg-stone-900 text-white border-stone-900'
              : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-100'
          }`}
        >
          <Sliders className="w-3 h-3" />
        </button>

        {/* Metronome Settings Popover */}
        {showMetronomeSettings && (
          <div className="absolute bottom-12 right-0 w-52 bg-white border border-stone-200 rounded-xl shadow-xl p-3 space-y-3 z-30">
            <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
              <span className="font-bold text-stone-900 text-xs">Metronome Options</span>
              <button
                onClick={() => setShowMetronomeSettings(false)}
                className="text-stone-400 hover:text-stone-700 text-xs"
              >
                ✕
              </button>
            </div>

            {/* Metronome Volume */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-600 font-medium">Click Volume</span>
                <span className="font-mono text-stone-900 font-bold">
                  {Math.round(metronomeVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={metronomeVolume}
                onChange={(e) => handleMetronomeVolumeChange(parseFloat(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>

            {/* Accent First Beat Toggle */}
            <label className="flex items-center justify-between text-[11px] text-stone-700 cursor-pointer pt-1 border-t border-stone-100">
              <span className="font-medium flex items-center space-x-1">
                <Bell className="w-3 h-3 text-amber-600" />
                <span>Accent 1st Beat</span>
              </span>
              <input
                type="checkbox"
                checked={accentFirstBeat}
                onChange={handleToggleAccent}
                className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
              />
            </label>
          </div>
        )}
      </div>

      {/* Input Devices: Virtual Piano & Web MIDI */}
      <div className="flex items-center space-x-2.5">
        {/* Web MIDI Keyboard Status / Setup */}
        {midiDevices.length === 0 ? (
          <button
            id="midi-device-btn"
            onClick={() => {
              midiService.initialize();
              if (onOpenMidiModal) onOpenMidiModal();
            }}
            title="MIDI: Not Connected. Click to scan for external USB/Bluetooth keyboards or open setup."
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all cursor-pointer active:scale-95 bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300 shadow-2xs"
          >
            <span className="w-2 h-2 rounded-full bg-stone-400" />
            <span>MIDI: Not Connected</span>
          </button>
        ) : midiDevices.length === 1 ? (
          <button
            id="midi-device-btn"
            onClick={() => {
              if (onOpenMidiModal) onOpenMidiModal();
            }}
            title={`MIDI Connected: ${midiDevices[0].name} (${midiDevices[0].manufacturer}) — Click to configure`}
            className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all cursor-pointer active:scale-95 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="font-semibold max-w-[130px] truncate">
              MIDI: {midiDevices[0].name}
            </span>
          </button>
        ) : (
          <div
            id="midi-multi-device-control"
            className="flex items-center space-x-1.5 bg-emerald-50 border border-emerald-300 rounded-lg px-2 py-1 shadow-2xs text-[11px]"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="font-bold text-emerald-900 shrink-0">MIDI:</span>
            <select
              id="midi-device-select"
              value={selectedDeviceId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedDeviceId(newId);
                midiService.setSelectedDeviceId(newId);
              }}
              title="Select MIDI Input Device"
              className="bg-white border border-emerald-300 rounded px-1.5 py-0.5 text-[11px] font-medium text-emerald-900 max-w-[120px] truncate focus:outline-hidden cursor-pointer"
            >
              <option value="all">All Devices ({midiDevices.length})</option>
              {midiDevices.map((dev) => (
                <option key={dev.id} value={dev.id}>
                  {dev.name}
                </option>
              ))}
            </select>
            <button
              id="midi-device-btn"
              onClick={() => {
                if (onOpenMidiModal) onOpenMidiModal();
              }}
              title="MIDI Settings"
              className="text-emerald-700 hover:text-emerald-950 p-0.5 rounded hover:bg-emerald-100 cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Virtual Piano Toggle Button */}
        <button
          id="virtual-piano-toggle-btn"
          onClick={onToggleVirtualPiano}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
            isVirtualPianoOpen
              ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs'
              : 'bg-stone-900 text-white border-stone-900 hover:bg-stone-800'
          }`}
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span>{isVirtualPianoOpen ? 'Hide Piano' : 'Virtual Piano'}</span>
        </button>
      </div>
    </footer>
  );
};
