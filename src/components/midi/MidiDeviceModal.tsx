import React, { useState, useEffect } from 'react';
import { midiService, MidiDevice, MidiActivity } from '../../services/midiService';
import {
  Radio,
  X,
  CheckCircle2,
  AlertTriangle,
  Settings2,
  Music,
  Volume2,
  Activity,
  Keyboard,
  RefreshCw,
} from 'lucide-react';
import { formatNoteLetter } from '../../utils/pianotasticNotation';

interface MidiDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  midiMode: 'playback' | 'entry';
  onSetMidiMode: (mode: 'playback' | 'entry') => void;
  quantization: string;
  onSetQuantization: (q: string) => void;
  selectedChannel: number; // 0 = all/omni, 1-16
  onSetSelectedChannel: (ch: number) => void;
  velocitySensitive: boolean;
  onSetVelocitySensitive: (val: boolean) => void;
}

export const MidiDeviceModal: React.FC<MidiDeviceModalProps> = ({
  isOpen,
  onClose,
  midiMode,
  onSetMidiMode,
  quantization,
  onSetQuantization,
  selectedChannel,
  onSetSelectedChannel,
  velocitySensitive,
  onSetVelocitySensitive,
}) => {
  const [isSupported, setIsSupported] = useState(midiService.getIsSupported());
  const [devices, setDevices] = useState<MidiDevice[]>(midiService.getConnectedDevices());
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    midiService.getSelectedDeviceId()
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isIframeBlocked, setIsIframeBlocked] = useState(midiService.getIsIframeRestricted());
  const [virtualActive, setVirtualActive] = useState(midiService.getIsVirtualEnabled());
  const [lastActivity, setLastActivity] = useState<MidiActivity | null>(
    midiService.getLastActivity()
  );
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    setIsSupported(midiService.getIsSupported());
    setIsIframeBlocked(midiService.getIsIframeRestricted());
    setVirtualActive(midiService.getIsVirtualEnabled());
    setSelectedDeviceId(midiService.getSelectedDeviceId());

    const unsubDevices = midiService.onDevicesChange((devs) => {
      setDevices(devs);
      setIsIframeBlocked(midiService.getIsIframeRestricted());
      setVirtualActive(midiService.getIsVirtualEnabled());
      setSelectedDeviceId(midiService.getSelectedDeviceId());
    });

    const unsubActivity = midiService.onActivity((act) => {
      setLastActivity(act);
      setIsFlashing(true);
      const timer = setTimeout(() => setIsFlashing(false), 200);
      return () => clearTimeout(timer);
    });

    return () => {
      unsubDevices();
      unsubActivity();
    };
  }, []);

  // Auto-connect when modal opens if not yet initialized
  useEffect(() => {
    if (isOpen) {
      handleScanOrConnect();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleScanOrConnect = async () => {
    setIsConnecting(true);
    setStatusMessage(null);
    try {
      const success = await midiService.initialize();
      setIsIframeBlocked(midiService.getIsIframeRestricted());
      if (success) {
        setStatusMessage('Web MIDI initialized. Hardware devices are ready to play.');
      } else {
        const err = midiService.getLastError();
        setStatusMessage(
          err || 'MIDI input is unavailable in this browser or permission was not granted.'
        );
      }
    } catch (e) {
      setStatusMessage('Error accessing MIDI: ' + (e as Error).message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSelectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    midiService.setSelectedDeviceId(deviceId);
  };

  const handleToggleVirtualDevice = () => {
    const next = !virtualActive;
    midiService.setVirtualDevice(next);
    setVirtualActive(next);
    if (next) {
      setStatusMessage('Virtual MIDI Keyboard enabled. Press test keys below to verify note entry.');
    }
  };

  const handlePlayTestPitch = (
    step: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B',
    octave: number = 4
  ) => {
    midiService.triggerVirtualNote({ step, octave, accidental: null }, 95);
  };

  const hardwareDevices = devices.filter((d) => !d.isVirtual);
  const isConnected = devices.length > 0;

  return (
    <div
      id="midi-device-modal-backdrop"
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 select-none"
      onClick={onClose}
    >
      <div
        id="midi-device-modal"
        className="bg-white rounded-xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden text-stone-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-stone-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Radio className="w-4 h-4 text-amber-400" />
            <div>
              <span className="font-bold text-sm tracking-wide block">External MIDI Setup</span>
              <span className="text-[10px] text-stone-400">
                Plug-and-play USB and Bluetooth MIDI keyboards
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
          {/* Status Bar */}
          <div
            id="midi-status-banner"
            className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${
              isConnected
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-stone-100 border-stone-300 text-stone-700'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'
                }`}
              />
              <div>
                <span className="font-bold block text-xs">
                  {isConnected
                    ? `MIDI: Connected (${devices.length} device${devices.length > 1 ? 's' : ''})`
                    : 'MIDI: Not Connected'}
                </span>
                <span className="text-[11px] text-stone-600 block">
                  {isConnected
                    ? hardwareDevices.length > 0
                      ? `Active hardware: ${hardwareDevices.map((d) => d.name).join(', ')}`
                      : 'Virtual MIDI Keyboard active'
                    : 'Plug in your external MIDI keyboard via USB or Bluetooth'}
                </span>
              </div>
            </div>

            <button
              onClick={handleScanOrConnect}
              disabled={isConnecting}
              className="flex items-center space-x-1 px-2.5 py-1 rounded bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 text-[11px]"
            >
              <RefreshCw className={`w-3 h-3 ${isConnecting ? 'animate-spin' : ''}`} />
              <span>{isConnecting ? 'Scanning...' : 'Scan / Reconnect'}</span>
            </button>
          </div>

          {/* Browser / Iframe Permission Notice */}
          {!isSupported ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-2.5 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Web MIDI Unavailable</p>
                <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                  MIDI input is unavailable in this browser or permission was not granted. Use
                  Google Chrome, Microsoft Edge, or Opera on desktop for full USB/Bluetooth MIDI
                  support.
                </p>
              </div>
            </div>
          ) : isIframeBlocked ? (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start space-x-2.5 text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Embedded Preview Note</p>
                <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                  Embedded iframes restrict direct hardware Web MIDI access. To connect a physical
                  USB/Bluetooth MIDI keyboard, open the app in a new browser tab. You can also test
                  with the Virtual MIDI Keyboard below.
                </p>
              </div>
            </div>
          ) : null}

          {/* Live Activity Monitor */}
          <div
            id="midi-live-monitor"
            className={`p-2.5 rounded-lg border transition-all duration-150 flex items-center justify-between ${
              isFlashing
                ? 'bg-amber-100 border-amber-400 shadow-sm'
                : 'bg-stone-50 border-stone-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Activity
                className={`w-3.5 h-3.5 ${isFlashing ? 'text-amber-700 animate-bounce' : 'text-stone-400'}`}
              />
              <span className="font-semibold text-stone-700">Live MIDI Input:</span>
              {lastActivity ? (
                <span className="font-mono font-bold text-stone-900">
                  {formatNoteLetter(lastActivity.pitch)} (MIDI {lastActivity.noteNumber}, Vel{' '}
                  {lastActivity.velocity})
                </span>
              ) : (
                <span className="text-stone-400 italic">Waiting for key press...</span>
              )}
            </div>
            {lastActivity && (
              <span className="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded font-semibold">
                Signal Received
              </span>
            )}
          </div>

          {/* Device List & Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-800">Detected MIDI Input Devices</span>
              {devices.length > 1 && (
                <span className="text-[10px] text-stone-500">
                  Select which device to listen to
                </span>
              )}
            </div>

            {devices.length === 0 ? (
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-lg text-center text-stone-500">
                <Keyboard className="w-6 h-6 mx-auto mb-1 text-stone-400" />
                <p className="font-medium">No MIDI devices detected yet.</p>
                <p className="text-[11px] text-stone-400 mt-1">
                  Connect your MIDI keyboard via USB cable. It will be detected automatically without
                  refreshing.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {devices.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleSelectDevice('all')}
                    className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                      selectedDeviceId === 'all'
                        ? 'bg-amber-50 border-amber-300 text-amber-950 font-semibold shadow-2xs'
                        : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                          selectedDeviceId === 'all'
                            ? 'border-amber-600 bg-amber-600 text-white'
                            : 'border-stone-300'
                        }`}
                      >
                        {selectedDeviceId === 'all' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <span className="block text-xs font-bold">
                          All Connected Inputs (Merge All)
                        </span>
                        <span className="block text-[10px] text-stone-500">
                          Listen to notes from all connected keyboards simultaneously
                        </span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                      {devices.length} Devices
                    </span>
                  </button>
                )}

                {devices.map((dev) => {
                  const isSelected =
                    selectedDeviceId === dev.id ||
                    (devices.length === 1 && selectedDeviceId === 'all');

                  return (
                    <button
                      key={dev.id}
                      type="button"
                      onClick={() => handleSelectDevice(dev.id)}
                      className={`w-full p-2.5 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-amber-50 border-amber-300 text-amber-950 font-semibold shadow-2xs'
                          : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? 'border-amber-600 bg-amber-600 text-white'
                              : 'border-stone-300'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <span className="block text-xs font-bold">{dev.name}</span>
                          <span className="block text-[10px] text-stone-500">
                            {dev.manufacturer || 'Generic'} • {dev.isVirtual ? 'Virtual' : 'Hardware'}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                        {isSelected ? 'Active Input' : 'Available'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Virtual MIDI Test Keyboard */}
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-bold text-stone-800 block text-xs">
                  Virtual MIDI Test Device
                </span>
                <span className="text-[10px] text-stone-500">
                  Simulate external MIDI note signals directly in the browser
                </span>
              </div>
              <button
                onClick={handleToggleVirtualDevice}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                  virtualActive
                    ? 'bg-amber-600 text-white'
                    : 'bg-stone-200 text-stone-700 hover:bg-stone-300'
                }`}
              >
                {virtualActive ? 'Enabled' : 'Enable'}
              </button>
            </div>

            {virtualActive && (
              <div className="pt-2 border-t border-stone-200">
                <span className="text-[10px] font-medium text-stone-600 block mb-1.5">
                  Click keys to send test MIDI note signals into the score:
                </span>
                <div className="flex items-center gap-1">
                  {(['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const).map((step) => (
                    <button
                      key={step}
                      onClick={() => handlePlayTestPitch(step, 4)}
                      className="flex-1 py-1.5 rounded bg-white hover:bg-amber-50 active:bg-amber-200 border border-stone-300 font-bold text-stone-800 text-xs shadow-2xs transition-colors cursor-pointer text-center"
                    >
                      {step}4
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* MIDI Channel & Filtering */}
          <div className="pt-2 border-t border-stone-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-800 text-xs">MIDI Channel</span>
              <span className="text-[10px] text-stone-500">Filter specific channel or listen to all</span>
            </div>
            <select
              value={selectedChannel}
              onChange={(e) => {
                const ch = parseInt(e.target.value, 10);
                onSetSelectedChannel(ch);
                midiService.setSelectedChannel(ch);
              }}
              className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs text-stone-800 font-medium focus:outline-hidden focus:ring-1 focus:ring-amber-500 cursor-pointer"
            >
              <option value="0">All Channels (Omni / Dual-Voice Protected)</option>
              {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                <option key={ch} value={ch}>
                  Channel {ch}
                </option>
              ))}
            </select>
          </div>

          {/* MIDI Input Mode */}
          <div className="pt-2 border-t border-stone-200 space-y-1.5">
            <span className="font-bold text-stone-800 block">MIDI Mode</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onSetMidiMode('entry')}
                className={`p-2.5 rounded-lg border text-left flex items-start space-x-2 transition-colors cursor-pointer ${
                  midiMode === 'entry'
                    ? 'bg-amber-50 text-amber-950 border-amber-300 font-semibold'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <Music className="w-4 h-4 mt-0.5 text-amber-600" />
                <div>
                  <span className="block font-bold">Note Entry Mode</span>
                  <span className="text-[10px] text-stone-500">
                    1 key press = exactly 1 notation note
                  </span>
                </div>
              </button>

              <button
                onClick={() => onSetMidiMode('playback')}
                className={`p-2.5 rounded-lg border text-left flex items-start space-x-2 transition-colors cursor-pointer ${
                  midiMode === 'playback'
                    ? 'bg-amber-50 text-amber-950 border-amber-300 font-semibold'
                    : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                }`}
              >
                <Volume2 className="w-4 h-4 mt-0.5 text-amber-600" />
                <div>
                  <span className="block font-bold">Playback Audition</span>
                  <span className="text-[10px] text-stone-500">
                    Audition sound only without score entry
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <p className="text-[11px] text-stone-600 bg-stone-100 p-2 rounded border border-stone-200">
              {statusMessage}
            </p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-stone-50 px-5 py-3 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-stone-900 text-white font-medium hover:bg-stone-800 text-xs shadow-2xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
