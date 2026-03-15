/**
 * upload.js — HTML5 File API + drag-and-drop image loader.
 *
 * Emits a custom 'imageloaded' event on the dropZone element with
 * { detail: { image: HTMLImageElement, file: File } }
 */

export class ImageUploader {
  /** @param {HTMLElement} dropZone @param {HTMLInputElement} fileInput */
  constructor(dropZone, fileInput) {
    this._zone  = dropZone;
    this._input = fileInput;
    this._bind();
  }

  // ── Public ──────────────────────────────────────────────────

  /** Programmatically open the file picker. */
  open() { this._input.click(); }

  // ── Private ─────────────────────────────────────────────────

  _bind() {
    // Click / keyboard on drop zone
    this._zone.addEventListener('click', () => this._input.click());
    this._zone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') this._input.click();
    });

    // File input change
    this._input.addEventListener('change', () => {
      if (this._input.files?.[0]) this._load(this._input.files[0]);
      this._input.value = '';           // allow reloading same file
    });

    // Drag events
    this._zone.addEventListener('dragover', e => {
      e.preventDefault();
      this._zone.classList.add('drag-over');
    });
    ['dragleave', 'dragend'].forEach(ev =>
      this._zone.addEventListener(ev, () => this._zone.classList.remove('drag-over'))
    );
    this._zone.addEventListener('drop', e => {
      e.preventDefault();
      this._zone.classList.remove('drag-over');
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith('image/')) this._load(file);
    });

    // Full-page drop fallback (prevents browser from navigating away)
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
      if (e.target !== this._zone) e.preventDefault();
    });
  }

  /**
   * Load a File as an HTMLImageElement, then fire 'imageloaded'.
   * @param {File} file
   */
  _load(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      this._zone.dispatchEvent(new CustomEvent('imageloaded', {
        bubbles: true,
        detail: { image: img, file },
      }));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      console.error('[upload] Failed to decode image:', file.name);
    };
    img.src = url;
  }
}
