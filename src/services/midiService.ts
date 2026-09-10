import { Pitch, NoteStep, AccidentalType } from '../types/score';

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: 'connected' | 'disconnected';
  connection?: 'open' | 'closed' | 'pending';
  isVirtual?: boolean;
}

export interface MidiActivity {
  noteNumber: number;
  pitch: Pitch;
  velocity: number;
  timestamp: number;
}

export type MidiConnectionStatus =
  | 'unsupported'   // Browser does not support Web MIDI
  | 'uninitialized' // Not yet requested
  | 'connecting'    // Requesting permission or opening ports
  | 'blocked'       // Permission denied or blocked by browser
  | 'connected'     // Connected to MIDI subsystem and device(s)
  | 'no_devices'    // Connected to subsystem but no physical devices detected
  | 'disconnected';  // Selected device was disconnected/unplugged

export type NoteListener = (pitch: Pitch, velocity: number) => void;
export type NoteOffListener = (noteNumber: number) => void;
export type ActiveKeyListener = (noteNumber: number, active: boolean) => void;
export type DeviceListener = (devices: MidiDevice[], activeDevice: MidiDevice | null) => void;
export type StatusListener = (status: MidiConnectionStatus, message: string | null) => void;
export type ActivityListener = (activity: MidiActivity) => void;

class MidiService {
  private midiAccess: any = null;

  // Single canonical note listener prevents listener accumulation or duplicate routing
  private canonicalNoteListener: NoteListener | null = null;
  private noteOffListeners: Set<NoteOffListener> = new Set();
  private activeKeyListeners: Set<ActiveKeyListener> = new Set();
  private deviceListeners: Set<DeviceListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private activityListeners: Set<ActivityListener> = new Set();

  private isSupported = false;
  private connectionStatus: MidiConnectionStatus = 'uninitialized';
  private statusMessage: string | null = null;
  private disconnectNotice: string | null = null;

  private connectedDevices: MidiDevice[] = [];
  private selectedDeviceId: string = '';
  private selectedChannel: number = 0; // 0 = all/omni, 1-16
  private isVirtualEnabled = false;

  private lastActivity: MidiActivity | null = null;
  private accidentalPreference: AccidentalType | null = null;
  private keySignature = 'C_major';

  // EXACTLY ONE attached input port reference
  private activeMidiInput: any = null;

  // Duplicate-event & hardware bounce protection
  private activePhysicalKeys: Set<number> = new Set();
  private lastNoteOnTimestamp: Map<number, number> = new Map();
  private lastNoteOffTimestamp: Map<number, number> = new Map();

  constructor() {
    this.isSupported =
      typeof navigator !== 'undefined' &&
      typeof (navigator as any).requestMIDIAccess === 'function';

    if (!this.isSupported) {
      this.connectionStatus = 'unsupported';
      this.statusMessage =
        'MIDI input is not supported in this browser. Please use a browser with Web MIDI support.';
    }
  }

  public getIsSupported(): boolean {
    return this.isSupported;
  }

  public getConnectionStatus(): MidiConnectionStatus {
    return this.connectionStatus;
  }

  public getStatusMessage(): string | null {
    return this.disconnectNotice || this.statusMessage;
  }

  public getConnectedDevices(): MidiDevice[] {
    return this.connectedDevices;
  }

  public getSelectedDeviceId(): string {
    return this.selectedDeviceId;
  }

  public getActiveDevice(): MidiDevice | null {
    if (!this.selectedDeviceId || this.selectedDeviceId === 'all') {
      return this.connectedDevices[0] || null;
    }
    return this.connectedDevices.find((d) => d.id === this.selectedDeviceId) || null;
  }

  public getSelectedChannel(): number {
    return this.selectedChannel;
  }

  public setSelectedChannel(channel: number) {
    this.selectedChannel = channel;
  }

  public getLastActivity(): MidiActivity | null {
    return this.lastActivity;
  }

  public setAccidentalPreference(acc: AccidentalType | null) {
    this.accidentalPreference = acc;
  }

  public setKeySignature(key: string) {
    this.keySignature = key;
  }

  public setVirtualDevice(enabled: boolean) {
    this.isVirtualEnabled = enabled;
    this.refreshDevices();
  }

  public getIsVirtualEnabled(): boolean {
    return this.isVirtualEnabled;
  }

  /**
   * Connect to Web MIDI.
   * Handles macOS permission flow, device enumeration, and class-compliant USB device opening.
   */
  public async connect(): Promise<boolean> {
    if (!this.isSupported) {
      this.connectionStatus = 'unsupported';
      this.statusMessage =
        'MIDI input is not supported in this browser. Please use a browser with Web MIDI support.';
      this.notifyStatus();
      return false;
    }

    this.connectionStatus = 'connecting';
    this.statusMessage = 'Requesting MIDI access...';
    this.disconnectNotice = null;
    this.notifyStatus();

    try {
      // macOS Web MIDI requirement: do not request sysex if we only need note input
      const access = await (navigator as any).requestMIDIAccess({ sysex: false });
      this.midiAccess = access;

      // Listen for hotplugging: USB connect / disconnect
      this.midiAccess.onstatechange = (event: any) => this.handleStateChange(event);

      await this.refreshDevices();

      if (this.connectedDevices.length > 0) {
        this.connectionStatus = 'connected';
        this.statusMessage = null;
      } else {
        this.connectionStatus = 'no_devices';
        this.statusMessage = 'No MIDI keyboard detected.';
      }

      this.notifyStatus();
      return true;
    } catch (err: any) {
      const errStr = (err?.message || String(err)).toLowerCase();
      const isDenied =
        err?.name === 'SecurityError' ||
        err?.name === 'NotAllowedError' ||
        errStr.includes('denied') ||
        errStr.includes('blocked') ||
        errStr.includes('permission');

      if (isDenied) {
        this.connectionStatus = 'blocked';
        this.statusMessage =
          'MIDI access is blocked. Please allow MIDI access in your browser and try again.';
      } else {
        this.connectionStatus = 'blocked';
        this.statusMessage =
          'MIDI access is blocked. Please allow MIDI access in your browser and try again.';
      }

      this.notifyStatus();
      return false;
    }
  }

  public async initialize(): Promise<boolean> {
    return this.connect();
  }

  /**
   * Disconnects the active MIDI listener intentionally.
   */
  public disconnect() {
    this.detachActiveListener();
    this.connectionStatus = 'disconnected';
    this.statusMessage = 'Disconnected';
    this.disconnectNotice = null;
    this.notifyStatus();
  }

  /**
   * Select a specific MIDI Input device.
   * Ensures the previous listener is completely removed before attaching the new one.
   */
  public setSelectedDeviceId(id: string) {
    if (this.selectedDeviceId === id) return;
    this.selectedDeviceId = id;
    this.attachSelectedInput();
    this.notifyDevices();
  }

  /**
   * Refreshes the list of connected MIDI input devices.
   */
  public async refreshDevices(): Promise<MidiDevice[]> {
    const devices: MidiDevice[] = [];

    if (this.midiAccess && this.midiAccess.inputs) {
      // Support both Iterable Map and forEach
      const inputs = this.midiAccess.inputs;
      if (typeof inputs.values === 'function') {
        for (const input of inputs.values()) {
          devices.push({
            id: input.id,
            name: input.name || 'USB MIDI Keyboard',
            manufacturer: input.manufacturer || 'Class Compliant',
            state: input.state || 'connected',
            connection: input.connection,
            isVirtual: false,
          });
        }
      } else if (typeof inputs.forEach === 'function') {
        inputs.forEach((input: any) => {
          devices.push({
            id: input.id,
            name: input.name || 'USB MIDI Keyboard',
            manufacturer: input.manufacturer || 'Class Compliant',
            state: input.state || 'connected',
            connection: input.connection,
            isVirtual: false,
          });
        });
      }
    }

    if (this.isVirtualEnabled) {
      devices.push({
        id: 'virtual-midi-device',
        name: 'Virtual MIDI Keyboard (Simulated)',
        manufacturer: 'Pianotastic Studio',
        state: 'connected',
        isVirtual: true,
      });
    }

    this.connectedDevices = devices;

    // Automatically select the first connected device if current selection is invalid
    const exists = devices.some((d) => d.id === this.selectedDeviceId);
    if (!exists) {
      const physicalDevice = devices.find((d) => !d.isVirtual);
      this.selectedDeviceId = physicalDevice ? physicalDevice.id : devices[0]?.id || '';
    }

    await this.attachSelectedInput();
    this.notifyDevices();
    return devices;
  }

  /**
   * Detaches midimessage handler from the currently active input port.
   */
  private detachActiveListener() {
    if (this.activeMidiInput) {
      try {
        this.activeMidiInput.onmidimessage = null;
      } catch {
        // ignore detached port errors
      }
      this.activeMidiInput = null;
    }
  }

  /**
   * Attaches exactly ONE listener to the selected input port.
   * Calls open() on macOS to ensure port is actively receiving packets.
   */
  private async attachSelectedInput(): Promise<void> {
    this.detachActiveListener();

    if (!this.midiAccess || !this.midiAccess.inputs || !this.selectedDeviceId) {
      return;
    }

    // Find the input port matching the selected device
    let targetPort: any = null;
    const inputs = this.midiAccess.inputs;

    if (typeof inputs.get === 'function') {
      targetPort = inputs.get(this.selectedDeviceId);
    }

    if (!targetPort && typeof inputs.values === 'function') {
      for (const input of inputs.values()) {
        if (input.id === this.selectedDeviceId) {
          targetPort = input;
          break;
        }
      }
    }

    if (!targetPort) return;

    try {
      // On macOS, explicitly opening the port is essential for class-compliant USB devices
      if (typeof targetPort.open === 'function' && targetPort.connection !== 'open') {
        await targetPort.open();
      }

      targetPort.onmidimessage = this.handleMidiMessage;
      this.activeMidiInput = targetPort;
      this.disconnectNotice = null;
    } catch (e) {
      console.warn('Failed to open MIDI input port on macOS:', e);
    }
  }

  /**
   * Hotplugging handler: detects device disconnects and reconnects.
   */
  private handleStateChange = async (event: any) => {
    const port = event?.port;
    if (!port || port.type !== 'input') return;

    if (port.state === 'disconnected') {
      // If the currently selected device was disconnected
      if (port.id === this.selectedDeviceId) {
        this.detachActiveListener();
        this.disconnectNotice = 'MIDI Keyboard disconnected.';
        this.connectionStatus = 'disconnected';
        this.notifyStatus();
      }
    }

    await this.refreshDevices();

    if (port.state === 'connected') {
      // If a device was plugged back in, clear disconnect notice
      if (this.connectedDevices.length > 0) {
        this.disconnectNotice = null;
        this.connectionStatus = 'connected';
        this.statusMessage = null;
        this.notifyStatus();
      }
    }
  };

  /**
   * The ONE and ONLY canonical Web MIDI message parser & dispatcher.
   * Enforces strict duplicate-event prevention, key-down tracking, and debounce guards.
   */
  private handleMidiMessage = (event: any) => {
    if (!event || !event.data || event.data.length < 2) return;

    const data = event.data;
    const statusByte = data[0];
    const noteNumber = data[1];
    const velocity = data.length > 2 ? data[2] : 64;

    const command = statusByte >> 4;
    const channel = (statusByte & 0x0f) + 1;

    // Filter by MIDI Channel if user selected a specific channel (1-16)
    if (this.selectedChannel !== 0 && channel !== this.selectedChannel) {
      return;
    }

    // Standard MIDI specification:
    // Command 9 (0x90) with velocity > 0 is Note On.
    // Command 8 (0x80) OR Command 9 with velocity === 0 is Note Off.
    const isTrueNoteOn = command === 9 && velocity > 0;
    const isTrueNoteOff = command === 8 || (command === 9 && velocity === 0);

    const now = performance.now();

    // 1. HANDLE NOTE OFF
    if (isTrueNoteOff) {
      this.activePhysicalKeys.delete(noteNumber);
      this.lastNoteOffTimestamp.set(noteNumber, now);

      // Release key illumination on on-screen piano
      this.notifyActiveKey(noteNumber, false);
      this.notifyNoteOff(noteNumber);

      // CRITICAL: A Note Off event NEVER inserts a note into the score. Return immediately.
      return;
    }

    // 2. HANDLE NOTE ON
    if (isTrueNoteOn) {
      // GUARD A: Key Already Depressed
      // If the user physically pressed a key and is holding it down:
      // it is already active. Suppress repeated artificial Note On events!
      if (this.activePhysicalKeys.has(noteNumber)) {
        return;
      }

      // GUARD B: Hardware Multi-Port / Echo Debounce Window (65ms)
      const lastOnTime = this.lastNoteOnTimestamp.get(noteNumber) || 0;
      if (now - lastOnTime < 65) {
        return;
      }

      // GUARD C: Switch Chatter / Release Bounce Guard (25ms)
      const lastOffTime = this.lastNoteOffTimestamp.get(noteNumber) || 0;
      if (now - lastOffTime < 25) {
        return;
      }

      // VALID UNIQUE PHYSICAL KEY PRESS
      this.activePhysicalKeys.add(noteNumber);
      this.lastNoteOnTimestamp.set(noteNumber, now);

      const pitch = this.midiNoteToPitch(
        noteNumber,
        this.accidentalPreference,
        this.keySignature
      );

      // Record activity for UI monitor
      this.lastActivity = {
        noteNumber,
        pitch,
        velocity,
        timestamp: Date.now(),
      };
      this.notifyActivity(this.lastActivity);

      // Illuminate key on virtual piano
      this.notifyActiveKey(noteNumber, true);

      // Route to the ONE canonical note-entry listener
      if (this.canonicalNoteListener) {
        this.canonicalNoteListener(pitch, velocity);
      }
    }
  };

  /**
   * Converts a MIDI note number (e.g. 60 = C4, 69 = A4, 72 = C5) into an exact musical Pitch.
   * Exact octave calculation: 60 -> C4, 72 -> C5, 48 -> C3. Never relies on Low/Middle/High.
   */
  public midiNoteToPitch(
    midi: number,
    accidentalPreference?: AccidentalType | null,
    keySignature?: string
  ): Pitch {
    // Standard MIDI: 60 = Middle C (C4), 12 = C0
    const semitonesFromC0 = midi - 12;
    const octave = Math.max(0, Math.min(8, Math.floor(semitonesFromC0 / 12)));
    const semitone = ((semitonesFromC0 % 12) + 12) % 12;

    const isFlatPreference =
      accidentalPreference === 'flat' ||
      (!accidentalPreference && this.isKeySignatureFlat(keySignature));

    if (isFlatPreference) {
      const FLAT_MAP: { step: NoteStep; accidental?: AccidentalType }[] = [
        { step: 'C' },
        { step: 'D', accidental: 'flat' }, // 1: Db
        { step: 'D' },                     // 2: D
        { step: 'E', accidental: 'flat' }, // 3: Eb
        { step: 'E' },                     // 4: E
        { step: 'F' },                     // 5: F
        { step: 'G', accidental: 'flat' }, // 6: Gb
        { step: 'G' },                     // 7: G
        { step: 'A', accidental: 'flat' }, // 8: Ab
        { step: 'A' },                     // 9: A
        { step: 'B', accidental: 'flat' }, // 10: Bb
        { step: 'B' },                     // 11: B
      ];
      const match = FLAT_MAP[semitone];
      return {
        step: match.step,
        octave,
        accidental: match.accidental ?? null,
      };
    } else {
      const SHARP_MAP: { step: NoteStep; accidental?: AccidentalType }[] = [
        { step: 'C' },
        { step: 'C', accidental: 'sharp' }, // 1: C#
        { step: 'D' },                      // 2: D
        { step: 'D', accidental: 'sharp' }, // 3: D#
        { step: 'E' },                      // 4: E
        { step: 'F' },                      // 5: F
        { step: 'F', accidental: 'sharp' }, // 6: F#
        { step: 'G' },                      // 7: G
        { step: 'G', accidental: 'sharp' }, // 8: G#
        { step: 'A' },                      // 9: A
        { step: 'B', accidental: 'flat' },  // 10: Bb
        { step: 'B' },                      // 11: B
      ];
      if (accidentalPreference === 'sharp') {
        SHARP_MAP[10] = { step: 'A', accidental: 'sharp' };
      }
      const match = SHARP_MAP[semitone];
      return {
        step: match.step,
        octave,
        accidental: match.accidental ?? null,
      };
    }
  }

  public pitchToMidiNote(pitch: Pitch): number {
    const stepOffsets: Record<NoteStep, number> = {
      C: 0,
      D: 2,
      E: 4,
      F: 5,
      G: 7,
      A: 9,
      B: 11,
    };
    let semitone = stepOffsets[pitch.step] || 0;
    if (pitch.accidental === 'sharp') semitone += 1;
    else if (pitch.accidental === 'double_sharp') semitone += 2;
    else if (pitch.accidental === 'flat') semitone -= 1;
    else if (pitch.accidental === 'double_flat') semitone -= 2;

    const baseMidi = 12 + pitch.octave * 12 + semitone;
    return Math.max(0, Math.min(127, baseMidi));
  }

  private isKeySignatureFlat(key?: string): boolean {
    if (!key) return false;
    const flatKeys = [
      'F_major',
      'Bb_major',
      'Eb_major',
      'Ab_major',
      'Db_major',
      'Gb_major',
      'Cb_major',
      'D_minor',
      'G_minor',
      'C_minor',
      'F_minor',
      'Bb_minor',
      'Eb_minor',
    ];
    return flatKeys.includes(key);
  }

  /**
   * Virtual keyboard note trigger for testing without physical hardware.
   */
  public triggerVirtualNote(pitch: Pitch, velocity: number = 95) {
    const midi = this.pitchToMidiNote(pitch);
    const now = performance.now();

    if (this.activePhysicalKeys.has(midi)) return;
    this.activePhysicalKeys.add(midi);
    this.lastNoteOnTimestamp.set(midi, now);

    this.lastActivity = {
      noteNumber: midi,
      pitch,
      velocity,
      timestamp: Date.now(),
    };
    this.notifyActivity(this.lastActivity);
    this.notifyActiveKey(midi, true);

    if (this.canonicalNoteListener) {
      this.canonicalNoteListener(pitch, velocity);
    }

    setTimeout(() => {
      this.activePhysicalKeys.delete(midi);
      this.lastNoteOffTimestamp.set(midi, performance.now());
      this.notifyActiveKey(midi, false);
      this.notifyNoteOff(midi);
    }, 250);
  }

  /**
   * Registers the single canonical note listener for workspace note entry.
   * Automatically replaces any previous listener to guarantee zero duplicate listeners.
   */
  public onNote(listener: NoteListener): () => void {
    this.canonicalNoteListener = listener;
    return () => {
      if (this.canonicalNoteListener === listener) {
        this.canonicalNoteListener = null;
      }
    };
  }

  public onNoteOff(listener: NoteOffListener): () => void {
    this.noteOffListeners.add(listener);
    return () => {
      this.noteOffListeners.delete(listener);
    };
  }

  public onActiveKeyChange(listener: ActiveKeyListener): () => void {
    this.activeKeyListeners.add(listener);
    return () => {
      this.activeKeyListeners.delete(listener);
    };
  }

  public onDevicesChange(listener: DeviceListener): () => void {
    this.deviceListeners.add(listener);
    listener(this.connectedDevices, this.getActiveDevice());
    return () => {
      this.deviceListeners.delete(listener);
    };
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    listener(this.connectionStatus, this.getStatusMessage());
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public onActivity(listener: ActivityListener): () => void {
    this.activityListeners.add(listener);
    if (this.lastActivity) {
      listener(this.lastActivity);
    }
    return () => {
      this.activityListeners.delete(listener);
    };
  }

  private notifyDevices() {
    const active = this.getActiveDevice();
    this.deviceListeners.forEach((l) => l(this.connectedDevices, active));
  }

  private notifyStatus() {
    const msg = this.getStatusMessage();
    this.statusListeners.forEach((l) => l(this.connectionStatus, msg));
  }

  private notifyActivity(activity: MidiActivity) {
    this.activityListeners.forEach((l) => l(activity));
  }

  private notifyActiveKey(noteNumber: number, active: boolean) {
    this.activeKeyListeners.forEach((l) => l(noteNumber, active));
  }

  private notifyNoteOff(noteNumber: number) {
    this.noteOffListeners.forEach((l) => l(noteNumber));
  }

  public dispose() {
    this.detachActiveListener();
    this.canonicalNoteListener = null;
    this.activePhysicalKeys.clear();
    this.lastNoteOnTimestamp.clear();
    this.lastNoteOffTimestamp.clear();
  }
}

export const midiService = new MidiService();
