/**
 * Merge progress overlay & merge report modal.
 * Extracted from app.js.
 */
import { t } from '../i18n.js';
import { escHtml } from '../utils/html.js';
import { $ } from '../state/store.js';

export function showMergeProgress() {
  const overlay = $('#merge-progress-overlay');
  const bar = $('#merge-progress-bar');
  const text = $('#merge-progress-text');
  bar.style.width = '0%';
  text.textContent = t('merge.progress.ready');
  overlay.style.display = 'flex';
}

export function updateMergeProgress(pct, label) {
  const bar = $('#merge-progress-bar');
  const text = $('#merge-progress-text');
  bar.style.width = `${Math.min(pct, 100)}%`;
  text.textContent = `${pct}% — ${label}`;
}

export function hideMergeProgress() {
  const overlay = $('#merge-progress-overlay');
  setTimeout(() => { overlay.style.display = 'none'; }, 300);
}

export function showMergeReport(successGroups, successDeletes, failures) {
  const modal = $('#merge-report-modal');
  const title = $('#merge-report-title');
  const body = $('#merge-report-body');
  const closeBtn = $('#merge-report-close');

  const hasFails = failures.length > 0;
  title.textContent = hasFails ? t('merge.report.partial') : t('merge.report.all.ok');

  let html = '<div class="report-summary">';
  html += `<div><span class="success">${t('merge.report.success')}</span> ${successGroups} ${t('dup.groups')}`;
  if (successDeletes > 0) html += t('merge.report.deleted', successDeletes);
  html += '</div>';
  if (hasFails) {
    html += `<div><span class="fail">${t('merge.report.failed')}</span> ${failures.length} ${t('dup.items')}</div>`;
  }
  html += '</div>';

  if (hasFails) {
    html += '<ul class="report-fail-list">';
    for (const f of failures) {
      html += `<li>
        <span class="fail-icon">❌</span>
        <div class="fail-detail">
          <div class="fail-label">${escHtml(f.label)}</div>
          <div class="fail-reason">${escHtml(f.reason)}</div>
        </div>
      </li>`;
    }
    html += '</ul>';
  }

  body.innerHTML = html;
  modal.style.display = 'flex';
  closeBtn.onclick = () => { modal.style.display = 'none'; };
}
