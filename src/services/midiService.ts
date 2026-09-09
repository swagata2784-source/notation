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

type NoteListener = (pitch: Pitch, velocity: number) => void;
type NoteOffListener = (noteNumber: number) => void;
type ActiveKeyListener = (noteNumber: number, active: boolean) => void;
type DeviceListener = (devices: MidiDevice[]) => void;
type ActivityListener = (activity: MidiActivity) => void;

class MidiService {
  private midiAccess: any = null;
  private noteListeners: NoteListener[] = [];
  private noteOffListeners: NoteOffListener[] = [];
  private activeKeyListeners: ActiveKeyListener[] = [];
  private deviceListeners: DeviceListener[] = [];
  private activityListeners: ActivityListener[] = [];
  private isSupported = false;
  private connectedDevices: MidiDevice[] = [];
  private selectedDeviceId = 'all';
  private isVirtualEnabled = false;
  private lastError: string | null = null;
  private isIframeRestricted = false;
  private lastActivity: MidiActivity | null = null;
  private accidentalPreference: AccidentalType | null = null;
  private keySignature = 'C_major';
  private isInitializing = false;
  private hasInitialized = false;

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
    this.selectedDeviceId = id;
    this.attachInputs();
    this.notifyDeviceListeners();
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
    this.lastActivity = {
      noteNumber: midi,
      pitch,
      velocity,
      timestamp: Date.now(),
    };
    this.activityListeners.forEach((l) => l(this.lastActivity!));
    this.activeKeyListeners.forEach((l) => l(midi, true));
    // Broadcast note into canonical note-entry function
    this.noteListeners.forEach((l) => l(pitch, velocity));

    setTimeout(() => {
      this.activeKeyListeners.forEach((l) => l(midi, false));
    }, 250);
  }

  private handleStateChange = () => {
    // Hotplugging handler: refresh devices and re-attach listeners automatically
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
    this.notifyDeviceListeners();
  }

  private notifyDeviceListeners() {
    this.deviceListeners.forEach((l) => l(this.connectedDevices));
  }

  private attachInputs() {
    if (!this.midiAccess || !this.midiAccess.inputs) return;

    const availableInputs: any[] = [];
    this.midiAccess.inputs.forEach((input: any) => {
      availableInputs.push(input);
    });

    // If selected device no longer exists, fallback to 'all'
    if (
      this.selectedDeviceId !== 'all' &&
      this.selectedDeviceId !== 'virtual-midi-device' &&
      !availableInputs.some((i) => i.id === this.selectedDeviceId)
    ) {
      this.selectedDeviceId = 'all';
    }

    availableInputs.forEach((input: any) => {
      const isTarget =
        this.selectedDeviceId === 'all' || this.selectedDeviceId === input.id;
      const isConnected = input.state === 'connected';

      if (isTarget && isConnected) {
        // Clean idempotent listener attachment
        input.onmidimessage = this.handleMidiMessage;
      } else {
        // Clean up previous listeners to prevent duplicate events or memory leaks
        input.onmidimessage = null;
      }
    });
  }

  private handleMidiMessage = (event: any) => {
    if (!event || !event.data || event.data.length < 2) return;

    const data = event.data;
    const status = data[0];
    const noteNumber = data[1];
    const velocity = data.length > 2 ? data[2] : 64;

    const command = status >> 4;
    // 0x9 = Note On, 0x8 = Note Off
    const isNoteOn = command === 9 && velocity > 0;
    const isNoteOff = command === 8 || (command === 9 && velocity === 0);

    if (isNoteOn) {
      const pitch = this.midiNoteToPitch(
        noteNumber,
        this.accidentalPreference,
        this.keySignature
      );

      // Record last activity for UI feedback
      this.lastActivity = {
        noteNumber,
        pitch,
        velocity,
        timestamp: Date.now(),
      };
      this.activityListeners.forEach((l) => l(this.lastActivity!));

      // Active key state for on-screen piano visual feedback
      this.activeKeyListeners.forEach((l) => l(noteNumber, true));

      // Forward to canonical note entry
      this.noteListeners.forEach((l) => l(pitch, velocity));
    } else if (isNoteOff) {
      // Release key visual state; NEVER insert a score note on Note Off
      this.activeKeyListeners.forEach((l) => l(noteNumber, false));
      this.noteOffListeners.forEach((l) => l(noteNumber));
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

  public onNote(listener: NoteListener): () => void {
    this.noteListeners.push(listener);
    return () => {
      this.noteListeners = this.noteListeners.filter((l) => l !== listener);
    };
  }

  public onNoteOff(listener: NoteOffListener): () => void {
    this.noteOffListeners.push(listener);
    return () => {
      this.noteOffListeners = this.noteOffListeners.filter((l) => l !== listener);
    };
  }

  public onActiveKeyChange(listener: ActiveKeyListener): () => void {
    this.activeKeyListeners.push(listener);
    return () => {
      this.activeKeyListeners = this.activeKeyListeners.filter((l) => l !== listener);
    };
  }

  public onDevicesChange(listener: DeviceListener): () => void {
    this.deviceListeners.push(listener);
    listener(this.connectedDevices);
    return () => {
      this.deviceListeners = this.deviceListeners.filter((l) => l !== listener);
    };
  }

  public onActivity(listener: ActivityListener): () => void {
    this.activityListeners.push(listener);
    if (this.lastActivity) {
      listener(this.lastActivity);
    }
    return () => {
      this.activityListeners = this.activityListeners.filter((l) => l !== listener);
    };
  }

  public getConnectedDevices(): MidiDevice[] {
    return this.connectedDevices;
  }
}

export const midiService = new MidiService();
