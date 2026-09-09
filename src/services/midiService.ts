import { Pitch, NoteStep, AccidentalType } from '../types/score';

export interface MidiDevice {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  isVirtual?: boolean;
}

export interface MidiActivity {
  noteNumber: number;
  pitch: Pitch;
  velocity: number;
  timestamp: number;
}

export type NoteListener = (pitch: Pitch, velocity: number) => void;
export type NoteOffListener = (noteNumber: number) => void;
export type ActiveKeyListener = (noteNumber: number, active: boolean) => void;
export type DeviceListener = (devices: MidiDevice[]) => void;
export type ActivityListener = (activity: MidiActivity) => void;

class MidiService {
  private midiAccess: any = null;

  // Single canonical note listener prevents listener accumulation or duplicate routing
  private canonicalNoteListener: NoteListener | null = null;
  private noteOffListeners: Set<NoteOffListener> = new Set();
  private activeKeyListeners: Set<ActiveKeyListener> = new Set();
  private deviceListeners: Set<DeviceListener> = new Set();
  private activityListeners: Set<ActivityListener> = new Set();

  private isSupported = false;
  private connectedDevices: MidiDevice[] = [];
  private selectedDeviceId: string = '';
  private selectedChannel: number = 0; // 0 = all/omni, 1-16 = specific channel
  private isVirtualEnabled = false;
  private lastError: string | null = null;
  private isIframeRestricted = false;
  private lastActivity: MidiActivity | null = null;
  private accidentalPreference: AccidentalType | null = null;
  private keySignature = 'C_major';
  private isInitializing = false;
  private hasInitialized = false;

  // Inputs currently bearing an active onmidimessage listener
  private attachedInputs: Set<any> = new Set();

  // Duplicate-event & hardware bounce protection
  private activePhysicalKeys: Set<number> = new Set();
  private lastNoteOnTimestamp: Map<number, number> = new Map();
  private lastNoteOffTimestamp: Map<number, number> = new Map();

  // Diagnostic metrics
  private totalRawEvents = 0;
  private canonicalNoteEntryCount = 0;

  constructor() {
    this.isSupported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  public getIsSupported(): boolean {
    return this.isSupported;
  }

  public getLastError(): string | null {
    return this.lastError;
  }

  public getIsIframeRestricted(): boolean {
    return this.isIframeRestricted;
  }

  public getIsVirtualEnabled(): boolean {
    return this.isVirtualEnabled;
  }

  public getSelectedDeviceId(): string {
    return this.selectedDeviceId;
  }

  public setSelectedDeviceId(id: string) {
    if (this.selectedDeviceId === id) return;
    this.selectedDeviceId = id;
    this.attachInputs();
    this.notifyDeviceListeners();
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

  public getCanonicalNoteEntryCount(): number {
    return this.canonicalNoteEntryCount;
  }

  public async initialize(): Promise<boolean> {
    if (this.hasInitialized && this.midiAccess) {
      this.attachInputs();
      this.updateDevices();
      return true;
    }
    if (this.isInitializing) {
      return false;
    }
    this.isInitializing = true;
    this.lastError = null;
    this.isIframeRestricted = false;

    if (!this.isSupported) {
      this.lastError = 'Web MIDI is unavailable in this browser or permission was not granted.';
      this.isInitializing = false;
      return false;
    }

    try {
      this.midiAccess = await (navigator as any).requestMIDIAccess({ sysex: false });
      this.hasInitialized = true;

      // Handle hotplugging: detect devices connected or disconnected after app is open
      this.midiAccess.onstatechange = this.handleStateChange;

      this.updateDevices();
      this.attachInputs();
      this.isInitializing = false;
      return true;
    } catch (err: any) {
      this.isInitializing = false;
      const msg = err?.message || String(err);
      if (
        err?.name === 'SecurityError' ||
        msg.toLowerCase().includes('permissions policy') ||
        msg.toLowerCase().includes('disallowed')
      ) {
        this.isIframeRestricted = true;
        this.lastError =
          'Web MIDI is restricted inside embedded iframe previews. Open the app in a new tab to connect physical MIDI keyboards.';
      } else {
        this.lastError = `MIDI input is unavailable in this browser or permission was not granted (${msg}).`;
      }
      this.updateDevices();
      return false;
    }
  }

  public setVirtualDevice(enabled: boolean) {
    this.isVirtualEnabled = enabled;
    this.updateDevices();
  }

  public triggerVirtualNote(pitch: Pitch, velocity: number = 95) {
    const midi = this.pitchToMidiNote(pitch);
    const now = performance.now();

    // Prevent virtual key re-triggering while already pressed
    if (this.activePhysicalKeys.has(midi)) return;
    this.activePhysicalKeys.add(midi);
    this.lastNoteOnTimestamp.set(midi, now);
    this.canonicalNoteEntryCount++;

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

  private handleStateChange = () => {
    // Hotplugging lifecycle: refresh device inventory and re-attach listener
    this.updateDevices();
    this.attachInputs();
  };

  public updateDevices() {
    const devices: MidiDevice[] = [];

    if (this.midiAccess && this.midiAccess.inputs) {
      this.midiAccess.inputs.forEach((input: any) => {
        devices.push({
          id: input.id,
          name: input.name || 'MIDI Keyboard',
          manufacturer: input.manufacturer || 'Generic',
          state: input.state || 'connected',
          isVirtual: false,
        });
      });
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

    // If selectedDeviceId is not set or no longer present in devices, pick the first valid device
    const hardwareDevices = devices.filter((d) => !d.isVirtual);
    const hasCurrent =
      this.selectedDeviceId === 'all' ||
      devices.some((d) => d.id === this.selectedDeviceId);

    if (!hasCurrent) {
      if (hardwareDevices.length > 0) {
        // Automatically default to the single first physical device (avoids dual-port echo)
        this.selectedDeviceId = hardwareDevices[0].id;
      } else if (devices.length > 0) {
        this.selectedDeviceId = devices[0].id;
      } else {
        this.selectedDeviceId = '';
      }
    }

    this.notifyDeviceListeners();
  }

  private notifyDeviceListeners() {
    this.deviceListeners.forEach((l) => l(this.connectedDevices));
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

  /**
   * Detaches midimessage handlers from all currently attached input ports
   */
  private detachAllInputs() {
    this.attachedInputs.forEach((input) => {
      try {
        input.onmidimessage = null;
      } catch (e) {
        // ignore detached port errors
      }
    });
    this.attachedInputs.clear();
  }

  /**
   * Attaches the single canonical handleMidiMessage listener to the selected MIDI input.
   * Cleans up all previous listeners first to guarantee zero duplicate listeners.
   */
  private attachInputs() {
    this.detachAllInputs();

    if (!this.midiAccess || !this.midiAccess.inputs) return;

    const availableInputs: any[] = [];
    this.midiAccess.inputs.forEach((input: any) => {
      availableInputs.push(input);
    });

    if (availableInputs.length === 0) return;

    // If selectedDeviceId is empty, select the first available input
    if (!this.selectedDeviceId) {
      this.selectedDeviceId = availableInputs[0].id;
    }

    if (this.selectedDeviceId === 'all') {
      // If user explicitly chose "All Devices (Merge)"
      availableInputs.forEach((input) => {
        if (input.state === 'connected') {
          input.onmidimessage = this.handleMidiMessage;
          this.attachedInputs.add(input);
        }
      });
    } else {
      // Default & Recommended: attach ONLY to the single selected device
      const target = availableInputs.find((i) => i.id === this.selectedDeviceId);
      if (target && target.state === 'connected') {
        target.onmidimessage = this.handleMidiMessage;
        this.attachedInputs.add(target);
      }
    }
  }

  /**
   * The ONE and ONLY canonical Web MIDI message parser & dispatcher.
   * Enforces strict duplicate-event prevention, key-down tracking, and debounce guards.
   */
  private handleMidiMessage = (event: any) => {
    if (!event || !event.data || event.data.length < 2) return;

    this.totalRawEvents++;
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
      // If the user physically pressed C4 once and is holding it down, or if a secondary port /
      // secondary channel (e.g. dual voice on a piano) sends a second Note On for the same note:
      // it is already active. Suppress the duplicate!
      if (this.activePhysicalKeys.has(noteNumber)) {
        return;
      }

      // GUARD B: Hardware Multi-Port / Echo Debounce Window
      // Real human fingers cannot strike the same piano key twice within 65 milliseconds.
      // Any Note On arriving within 65ms of the previous Note On for the same note number is a
      // driver echo, dual port duplicate, or key bounce.
      const lastOnTime = this.lastNoteOnTimestamp.get(noteNumber) || 0;
      if (now - lastOnTime < 65) {
        return;
      }

      // GUARD C: Switch Chatter / Release Bounce Guard
      // If a Note On arrives within 25ms of a Note Off for the exact same note, suppress contact chatter.
      const lastOffTime = this.lastNoteOffTimestamp.get(noteNumber) || 0;
      if (now - lastOffTime < 25) {
        return;
      }

      // VALID UNIQUE PHYSICAL KEY PRESS
      this.activePhysicalKeys.add(noteNumber);
      this.lastNoteOnTimestamp.set(noteNumber, now);
      this.canonicalNoteEntryCount++;

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
        { step: 'B', accidental: 'flat' },  // 10: Bb (standard default in musical notation)
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
   * Registers the single canonical note listener for workspace note entry.
   * Automatically replaces any previous listener to ensure exactly one listener exists.
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
    listener(this.connectedDevices);
    return () => {
      this.deviceListeners.delete(listener);
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

  public getConnectedDevices(): MidiDevice[] {
    return this.connectedDevices;
  }

  /**
   * Cleanup on unmount or reset
   */
  public dispose() {
    this.detachAllInputs();
    this.canonicalNoteListener = null;
    this.activePhysicalKeys.clear();
    this.lastNoteOnTimestamp.clear();
    this.lastNoteOffTimestamp.clear();
  }
}

export const midiService = new MidiService();
