/**
 * results.js — Measurement results table + Chart.js bar chart.
 */

import { formatMeasurement, toCSV } from './measurer.js';

/** @typedef {{ id:number, label:string, px:number, mm:number|null, isReference:boolean }} Measurement */

export class ResultsPanel {
  /**
   * @param {HTMLTableSectionElement} tbody
   * @param {HTMLSelectElement}       refSelect
   * @param {HTMLCanvasElement}       chartCanvas
   * @param {HTMLButtonElement}       exportBtn
   * @param {(id:number)=>void}       onDelete
   */
  constructor(tbody, refSelect, chartCanvas, exportBtn, onDelete) {
    this._tbody      = tbody;
    this._refSelect  = refSelect;
    this._chartEl    = chartCanvas;
    this._exportBtn  = exportBtn;
    this._onDelete   = onDelete;
    this._chart      = null;
    this._measurements = [];
  }

  // ── Public API ───────────────────────────────────────────────

  /** @param {Measurement[]} measurements */
  update(measurements) {
    this._measurements = measurements;
    this._renderTable(measurements);
    this._renderRefSelect(measurements);
    this._renderChart(measurements);
    this._exportBtn.disabled = measurements.length === 0;
  }

  exportCSV() {
    if (!this._measurements.length) return;
    const csv  = toCSV(this._measurements);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href:     url,
      download: `measurements_${Date.now()}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Private ──────────────────────────────────────────────────

  _renderTable(ms) {
    this._tbody.innerHTML = '';
    if (!ms.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" style="color:var(--text-sec);text-align:center;padding:10px">–</td>';
      this._tbody.appendChild(tr);
      return;
    }
    ms.forEach(m => {
      const tr = document.createElement('tr');
      const mmCell = m.mm != null
        ? `<td class="${m.isReference ? 'ref-cell' : ''}">${m.mm.toFixed(1)} mm</td>`
        : `<td style="color:var(--text-sec)">–</td>`;
      tr.innerHTML = `
        <td>${m.label}${m.isReference ? ' ★' : ''}</td>
        <td>${Math.round(m.px)} px</td>
        ${mmCell}
        <td><button class="del-btn" data-id="${m.id}" title="Poista">✕</button></td>`;
      this._tbody.appendChild(tr);
    });
    this._tbody.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', () => this._onDelete(Number(btn.dataset.id)));
    });
  }

  _renderRefSelect(ms) {
    const prev = this._refSelect.value;
    this._refSelect.innerHTML = '<option value="">–</option>';
    ms.forEach(m => {
      const opt = document.createElement('option');
      opt.value       = String(m.id);
      opt.textContent = `${m.label} (${Math.round(m.px)} px)`;
      if (m.isReference) opt.textContent += ' ★';
      this._refSelect.appendChild(opt);
    });
    this._refSelect.value = prev;
  }

  _renderChart(ms) {
    if (!ms.length) {
      this._chart?.destroy();
      this._chart = null;
      return;
    }

    const labels = ms.map(m => m.label);
    const values = ms.map(m => m.mm != null ? m.mm : m.px);
    const unit   = ms.some(m => m.mm != null) ? 'mm' : 'px';
    const colors = ms.map(m => m.isReference ? '#FFD700' : '#7c6af7');

    if (this._chart) {
      this._chart.data.labels          = labels;
      this._chart.data.datasets[0].data   = values;
      this._chart.data.datasets[0].backgroundColor = colors;
      this._chart.options.plugins.title.text = `Mitat (${unit})`;
      this._chart.update();
      return;
    }

    this._chart = new Chart(this._chartEl, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: unit,
          data: values,
          backgroundColor: colors,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: `Mitat (${unit})`,
            color: '#8888a8',
            font: { size: 11 },
          },
        },
        scales: {
          x: { ticks: { color: '#8888a8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.05)' } },
          y: { ticks: { color: '#8888a8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.05)' } },
        },
      },
    });
  }
}
