// The two small corner buttons (sound on/off, pause) and the pause menu. Plain HTML laid over
// the canvas, so pressing them never also steers or fires the ship. Works with mouse, touch,
// keyboard (arrows / Enter / Esc) and gamepad (d-pad, A, B; Start is handled by the shell).

import type { MenuEdges } from '../input/menuNav.js';

export interface HudCallbacks {
  onSoundToggle(): void;
  onVolume(v: number): void; // 0..1, while dragging
  onPauseRequest(): void; // the corner pause button
  onResume(): void;
  onQuit(): void; // "return to menu", after confirming
  onUiSound(): void; // a menu button was pressed
}

type View = 'main' | 'confirm';

const CSS = `
#rocHudButtons { position: fixed; top: 20px; right: 8px; display: flex; gap: 6px; z-index: 20; }
#rocHudButtons button {
  width: 30px; height: 30px; padding: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.35); color: rgba(255,255,255,0.55); border: 1px solid rgba(255,255,255,0.25);
  border-radius: 4px; cursor: pointer; touch-action: manipulation;
}
#rocHudButtons button:hover { color: #fff; border-color: rgba(255,255,255,0.6); }
#rocHudButtons svg { width: 16px; height: 16px; }
#rocPause {
  position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.55); z-index: 30; font: 15px monospace; color: #fff;
}
#rocPause.open { display: flex; }
#rocPause .panel {
  min-width: 250px; padding: 22px 26px; background: #000; border: 1px solid rgba(255,255,255,0.5);
  display: flex; flex-direction: column; gap: 10px; text-align: center;
}
#rocPause h2 { margin: 0 0 6px; font: bold 22px monospace; letter-spacing: 3px; }
#rocPause p { margin: 0 0 4px; color: #9ab; }
#rocPause button, #rocPause .vol {
  font: 15px monospace; color: #fff; background: #000; border: 1px solid rgba(255,255,255,0.35);
  padding: 9px 12px; cursor: pointer; touch-action: manipulation;
}
#rocPause .vol { display: flex; align-items: center; gap: 10px; cursor: default; }
#rocPause .vol input { flex: 1; accent-color: #9ab; cursor: pointer; }
#rocPause .focused, #rocPause button:hover { border-color: #ffd76b; color: #ffd76b; }
#rocPause .view { display: none; flex-direction: column; gap: 10px; }
#rocPause .view.active { display: flex; }
`;

const ICON_SOUND_ON =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" stroke="none"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6 6 0 0 1 0 9"/></svg>';
const ICON_SOUND_OFF =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" stroke="none"/><path d="M11 6l4 4M15 6l-4 4"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3.5" y="3" width="3" height="10"/><rect x="9.5" y="3" width="3" height="10"/></svg>';

export class Hud {
  private readonly cb: HudCallbacks;
  private readonly soundBtn: HTMLButtonElement;
  private readonly pauseBtn: HTMLButtonElement;
  private readonly overlay: HTMLDivElement;
  private readonly menuSoundBtn: HTMLButtonElement;
  private readonly slider: HTMLInputElement;
  private readonly views: Record<View, HTMLDivElement>;
  private readonly controls: Record<View, HTMLElement[]>;
  private view: View = 'main';
  private focus = 0;
  private pauseVisible: boolean | null = null;
  private _open = false;

  constructor(cb: HudCallbacks, initial: { enabled: boolean; volume: number }) {
    this.cb = cb;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // Corner buttons.
    const bar = document.createElement('div');
    bar.id = 'rocHudButtons';
    this.soundBtn = button('', 'Sound on/off', () => this.cb.onSoundToggle());
    this.pauseBtn = button(ICON_PAUSE, 'Pause', () => this.cb.onPauseRequest());
    bar.append(this.soundBtn, this.pauseBtn);

    // Pause menu.
    this.overlay = document.createElement('div');
    this.overlay.id = 'rocPause';
    const panel = document.createElement('div');
    panel.className = 'panel';

    const resume = button('Resume', 'Resume', () => this.ui(() => this.cb.onResume()));
    this.menuSoundBtn = button('', 'Sound on/off', () => this.ui(() => this.cb.onSoundToggle()));
    const vol = document.createElement('label');
    vol.className = 'vol';
    vol.append('Volume');
    this.slider = document.createElement('input');
    this.slider.type = 'range';
    this.slider.min = '0';
    this.slider.max = '100';
    this.slider.step = '5';
    this.slider.tabIndex = -1;
    this.slider.addEventListener('input', () => this.cb.onVolume(Number(this.slider.value) / 100));
    this.slider.addEventListener('change', () => {
      this.slider.blur();
      this.cb.onUiSound(); // a little click at the new level
    });
    vol.append(this.slider);
    const quit = button('Return to menu', 'Return to menu', () => this.ui(() => this.setView('confirm')));
    const main = view([heading('PAUSED'), resume, this.menuSoundBtn, vol, quit]);

    const no = button('No, keep playing', 'Cancel', () => this.ui(() => this.setView('main')));
    const yes = button('Yes, abandon run', 'Abandon run', () => this.ui(() => this.cb.onQuit()));
    const note = document.createElement('p');
    note.textContent = 'This run will not be scored.';
    const confirm = view([heading('ABANDON RUN?'), note, no, yes]);

    this.views = { main, confirm };
    this.controls = { main: [resume, this.menuSoundBtn, vol, quit], confirm: [no, yes] };
    panel.append(main, confirm);
    this.overlay.append(panel);
    // A tap on the dimmed background (outside the panel) does nothing, but mustn't reach the game.
    document.body.append(bar, this.overlay);

    window.addEventListener('keydown', (e) => this.onKey(e), true);
    this.setSound(initial.enabled);
    this.setVolume(initial.volume);
    this.setView('main');
  }

  get isOpen(): boolean {
    return this._open;
  }

  open(): void {
    if (this._open) return;
    this._open = true;
    this.setView('main');
    this.overlay.classList.add('open');
  }

  close(): void {
    if (!this._open) return;
    this._open = false;
    this.overlay.classList.remove('open');
  }

  setSound(on: boolean): void {
    this.soundBtn.innerHTML = on ? ICON_SOUND_ON : ICON_SOUND_OFF;
    this.soundBtn.title = on ? 'Sound off' : 'Sound on';
    this.menuSoundBtn.textContent = on ? 'Sound: ON' : 'Sound: OFF';
  }

  setVolume(v: number): void {
    this.slider.value = String(Math.round(v * 20) * 5);
  }

  // The pause button only makes sense during a run; touch the DOM only when it changes.
  setPauseVisible(visible: boolean): void {
    if (visible === this.pauseVisible) return;
    this.pauseVisible = visible;
    this.pauseBtn.style.display = visible ? '' : 'none';
  }

  // Gamepad navigation while the menu is open.
  handlePad(m: MenuEdges): void {
    if (!this._open) return;
    if (m.up) this.moveFocus(-1);
    if (m.down) this.moveFocus(1);
    if (m.left) this.nudgeVolume(-1);
    if (m.right) this.nudgeVolume(1);
    if (m.select) this.activate();
    if (m.back) this.back();
  }

  private onKey(e: KeyboardEvent): void {
    if (!this._open) return;
    // Esc is left to the game's own pause key, which toggles the menu shut.
    const handled = (): void => {
      e.preventDefault();
      e.stopPropagation();
    };
    switch (e.key) {
      case 'ArrowUp':
        this.moveFocus(-1);
        return handled();
      case 'ArrowDown':
        this.moveFocus(1);
        return handled();
      case 'ArrowLeft':
        this.nudgeVolume(-1);
        return handled();
      case 'ArrowRight':
        this.nudgeVolume(1);
        return handled();
      case 'Enter':
      case ' ':
        this.activate();
        return handled();
      case 'Backspace':
        this.back();
        return handled();
    }
  }

  private back(): void {
    if (this.view === 'confirm') this.ui(() => this.setView('main'));
    else this.ui(() => this.cb.onResume());
  }

  private setView(v: View): void {
    this.view = v;
    for (const [name, el] of Object.entries(this.views)) el.classList.toggle('active', name === v);
    this.focus = 0;
    this.showFocus();
  }

  private moveFocus(d: number): void {
    const n = this.controls[this.view].length;
    this.focus = (this.focus + d + n) % n;
    this.showFocus();
  }

  private showFocus(): void {
    for (const view of Object.values(this.controls)) view.forEach((el) => el.classList.remove('focused'));
    this.controls[this.view][this.focus]?.classList.add('focused');
  }

  private activate(): void {
    const el = this.controls[this.view][this.focus];
    if (el instanceof HTMLButtonElement) el.click();
  }

  // Left/right changes the volume when the slider row is highlighted.
  private nudgeVolume(d: number): void {
    if (this.controls[this.view][this.focus] !== this.slider.parentElement) return;
    const v = Math.max(0, Math.min(100, Number(this.slider.value) + d * 10));
    this.slider.value = String(v);
    this.cb.onVolume(v / 100);
    this.cb.onUiSound();
  }

  private ui(fn: () => void): void {
    this.cb.onUiSound();
    fn();
  }
}

function button(html: string, label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = html;
  b.setAttribute('aria-label', label);
  b.tabIndex = -1; // menu focus is managed here, so Space (fire) can never press a stray button
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    b.blur();
    onClick();
  });
  return b;
}

function heading(text: string): HTMLHeadingElement {
  const h = document.createElement('h2');
  h.textContent = text;
  return h;
}

function view(children: HTMLElement[]): HTMLDivElement {
  const d = document.createElement('div');
  d.className = 'view';
  d.append(...children);
  return d;
}
