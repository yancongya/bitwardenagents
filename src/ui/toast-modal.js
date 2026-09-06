/**
 * Toast notifications & confirm modal.
 * Extracted from app.js — depends only on DOM helpers.
 */

export function showToast(message, type = 'info') {
  const container = document.querySelector('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

export function showConfirm(title, message, onConfirm) {
  const modal = document.querySelector('#confirm-modal');
  document.querySelector('#modal-title').textContent = title;
  document.querySelector('#modal-message').textContent = message;
  modal.style.display = 'flex';

  const confirmBtn = document.querySelector('#modal-confirm');
  const cancelBtn = document.querySelector('#modal-cancel');

  const cleanup = () => { modal.style.display = 'none'; };

  confirmBtn.onclick = () => { cleanup(); onConfirm(); };
  cancelBtn.onclick = cleanup;
}

export function closeModal() {
  document.querySelector('#confirm-modal').style.display = 'none';
}
