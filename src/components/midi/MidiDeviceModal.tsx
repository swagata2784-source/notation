import React, { useState, useEffect } from 'react';
import {
  X,
  Piano,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sliders,
  HelpCircle,
  Laptop,
  Check,
  Power,
  ChevronDown,
} from 'lucide-react';
import {
  midiService,
  MidiDevice,
  MidiConnectionStatus,
  MidiActivity,
} from '../../services/midiService';

interface MidiDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  midiMode: 'editor' | 'entry' | 'playback';
  onSetMidiMode: (mode: any) => void;
  quantization: string;
  onSetQuantization: (q: string) => void;
  selectedChannel: number;
  onSetSelectedChannel: (ch: number) => void;
  velocitySensitive: boolean;
  onSetVelocitySensitive: (val: boolean) => void;
}

export const MidiDeviceModal: React.FC<MidiDeviceModalProps> = ({
  isOpen,
  onClose,
  midiMode,
  onSetMidiMode,
  selectedChannel,
  onSetSelectedChannel,
}) => {
  const [isSupported, setIsSupported] = useState<boolean>(midiService.getIsSupported());
  const [status, setStatus] = useState<MidiConnectionStatus>(midiService.getConnectionStatus());
  const [statusMessage, setStatusMessage] = useState<string | null>(midiService.getStatusMessage());
  const [devices, setDevices] = useState<MidiDevice[]>(midiService.getConnectedDevices());
  const [activeDevice, setActiveDevice] = useState<MidiDevice | null>(midiService.getActiveDevice());
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(midiService.getSelectedDeviceId());
  const [isConnecting, setIsConnecting] = useState(false);
  const [isVirtualEnabled, setIsVirtualEnabled] = useState(midiService.getIsVirtualEnabled());
  const [recentActivity, setRecentActivity] = useState<MidiActivity | null>(null);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  useEffect(() => {
    setIsSupported(midiService.getIsSupported());
    setStatus(midiService.getConnectionStatus());
    setStatusMessage(midiService.getStatusMessage());
    setDevices(midiService.getConnectedDevices());
    setActiveDevice(midiService.getActiveDevice());
    setSelectedDeviceId(midiService.getSelectedDeviceId());

    const unsubDevices = midiService.onDevicesChange((devs, active) => {
      setDevices(devs);
      setActiveDevice(active);
      setSelectedDeviceId(midiService.getSelectedDeviceId());
    });

    const unsubStatus = midiService.onStatusChange((st, msg) => {
      setStatus(st);
      setStatusMessage(msg);
      if (st === 'no_devices') {
        setShowTroubleshooting(true);
      }
    });

    const unsubActivity = midiService.onActivity((act) => {
      setRecentActivity(act);
    });

    return () => {
      unsubDevices();
      unsubStatus();
      unsubActivity();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await midiService.connect();
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    midiService.disconnect();
  };

  const handleSelectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    midiService.setSelectedDeviceId(deviceId);
  };

  const handleToggleVirtual = (enabled: boolean) => {
    setIsVirtualEnabled(enabled);
    midiService.setVirtualDevice(enabled);
  };

  const isConnected = status === 'connected' && activeDevice !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        id="midi-modal-container"
        className="bg-white rounded-xl shadow-2xl border border-stone-200 max-w-lg w-full overflow-hidden flex flex-col font-sans"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-900">
              <Piano className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 tracking-tight">
                MIDI Keyboard
              </h2>
              <p className="text-[11px] text-stone-500">
                Connect external USB or Bluetooth keyboard for notation input
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* 1. MAIN CONNECTION STATUS & CONTROLS */}
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                Status
              </span>

              {/* Status Pill */}
              {isConnected ? (
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Connected ●</span>
                </div>
              ) : status === 'blocked' ? (
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-300 text-red-800 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span>Access Blocked</span>
                </div>
              ) : status === 'unsupported' ? (
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-stone-100 border border-stone-300 text-stone-700 text-xs font-semibold">
                  <span>Not Supported</span>
                </div>
              ) : status === 'disconnected' ? (
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Disconnected</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-stone-100 border border-stone-300 text-stone-600 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-stone-400" />
                  <span>Not Connected</span>
                </div>
              )}
            </div>

            {/* Device Info & Connect/Disconnect Actions */}
            {isConnected && activeDevice ? (
              <div className="space-y-3 pt-1">
                <div className="bg-white p-3 rounded-lg border border-stone-200 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                      <Piano className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-stone-900">
                        {activeDevice.name}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {activeDevice.manufacturer}
                      </div>
                    </div>
                  </div>
                  <button
                    id="midi-disconnect-btn"
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-xs font-medium text-stone-700 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>

                {/* Multiple Device Selector if more than 1 device */}
                {devices.length > 1 && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-600">
                      MIDI Input:
                    </label>
                    <div className="relative">
                      <select
                        id="midi-input-select"
                        value={selectedDeviceId}
                        onChange={(e) => handleSelectDevice(e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs font-medium text-stone-800 appearance-none pr-8 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        {devices.map((dev) => (
                          <option key={dev.id} value={dev.id}>
                            {dev.name} {dev.isVirtual ? '(Simulated)' : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <button
                  id="midi-connect-btn"
                  onClick={handleConnect}
                  disabled={!isSupported || isConnecting}
                  className="w-full py-2.5 px-4 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-medium text-xs flex items-center justify-center space-x-2 transition-colors disabled:opacity-50 shadow-xs"
                >
                  {isConnecting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Connecting to MIDI...</span>
                    </>
                  ) : (
                    <>
                      <Power className="w-3.5 h-3.5" />
                      <span>Connect MIDI</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Error / Status Messages */}
            {statusMessage && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start space-x-2.5 ${
                  status === 'blocked'
                    ? 'bg-red-50 border border-red-200 text-red-800'
                    : status === 'disconnected'
                    ? 'bg-amber-50 border border-amber-200 text-amber-900'
                    : 'bg-stone-100 border border-stone-200 text-stone-700'
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{statusMessage}</div>
              </div>
            )}
          </div>

          {/* 2. BROWSER SUPPORT NOTICE (SAFARI / NON-WEB MIDI) */}
          {!isSupported && (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 text-amber-950 space-y-1.5 text-xs">
              <div className="font-semibold flex items-center space-x-1.5">
                <Laptop className="w-4 h-4 text-amber-700" />
                <span>Browser Compatibility</span>
              </div>
              <p className="text-stone-600 leading-relaxed">
                MIDI input is not supported in this browser. Please use Google Chrome, Microsoft Edge,
                or Brave on macOS to connect your physical USB MIDI keyboard.
              </p>
            </div>
          )}

          {/* 3. USER-FRIENDLY TROUBLESHOOTING CHECKLIST */}
          {(showTroubleshooting || status === 'no_devices') && isSupported && (
            <div className="p-4 rounded-xl border border-stone-200 bg-white space-y-2.5 text-xs text-stone-700 shadow-2xs">
              <div className="flex items-center justify-between font-semibold text-stone-900">
                <span className="flex items-center space-x-1.5">
                  <HelpCircle className="w-4 h-4 text-amber-700" />
                  <span>No MIDI keyboard detected</span>
                </span>
                <button
                  onClick={() => handleConnect()}
                  className="text-amber-800 hover:text-amber-950 font-bold flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Scan Again</span>
                </button>
              </div>
              <p className="text-stone-500">Please check the following items:</p>
              <ol className="list-decimal pl-4 space-y-1 text-stone-600">
                <li>The keyboard is powered on.</li>
                <li>The USB cable supports data transfer (not charge-only).</li>
                <li>The keyboard appears as a MIDI device on the Mac (Audio MIDI Setup).</li>
                <li>The browser has MIDI permission granted.</li>
                <li>Try disconnecting and reconnecting the USB cable.</li>
                <li>Try a supported Web MIDI browser (Chrome / Edge / Brave).</li>
              </ol>
            </div>
          )}

          {/* 4. REAL-TIME NOTE ACTIVITY MONITOR */}
          {recentActivity && (
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="font-medium text-emerald-950">Received Key Press:</span>
                <span className="font-bold text-emerald-900 font-serif text-sm">
                  {recentActivity.pitch.step}
                  {recentActivity.pitch.accidental === 'sharp'
                    ? '♯'
                    : recentActivity.pitch.accidental === 'flat'
                    ? '♭'
                    : ''}
                  <sup>{recentActivity.pitch.octave}</sup>
                </span>
              </div>
              <span className="text-[11px] text-emerald-700 font-mono">
                MIDI {recentActivity.noteNumber} • Vel {recentActivity.velocity}
              </span>
            </div>
          )}

          {/* 5. MIDI CHANNELS & VIRTUAL SIMULATION */}
          <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
            <div className="flex items-center space-x-2">
              <Sliders className="w-3.5 h-3.5 text-stone-400" />
              <span>MIDI Channel:</span>
              <select
                value={selectedChannel}
                onChange={(e) => onSetSelectedChannel(Number(e.target.value))}
                className="bg-white border border-stone-200 rounded px-2 py-0.5 text-xs text-stone-800"
              >
                <option value={0}>All Channels (Omni)</option>
                {Array.from({ length: 16 }, (_, i) => i + 1).map((ch) => (
                  <option key={ch} value={ch}>
                    Channel {ch}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center space-x-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isVirtualEnabled}
                onChange={(e) => handleToggleVirtual(e.target.checked)}
                className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-[11px] text-stone-500">Virtual Simulator</span>
            </label>
          </div>

          {/* 6. DIAGNOSTIC INFORMATION (SIMPLE & CLEAN) */}
          <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 text-[11px] text-stone-600 space-y-1">
            <div className="font-semibold text-stone-700 uppercase tracking-wider text-[10px]">
              MIDI Diagnostics
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
              <div>
                <span className="text-stone-400 block text-[10px]">Access:</span>
                <span className="font-semibold text-stone-800">
                  {isSupported ? 'Available' : 'Unavailable'}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">Active Input:</span>
                <span className="font-semibold text-stone-800 truncate block">
                  {activeDevice ? activeDevice.name : 'None'}
                </span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px]">Status:</span>
                <span
                  className={`font-semibold ${
                    isConnected ? 'text-emerald-700' : 'text-stone-600'
                  }`}
                >
                  {isConnected ? 'Connected' : 'Not Connected'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-stone-100 flex items-center justify-end bg-stone-50/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white font-medium text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
