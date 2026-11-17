/**
 * Opens a modal dialog and notifies it with a `modal:open` event.
 * @param {string} id Dialog id without the `modal-` prefix.
 * @param {Record<string, string>} [detail] Data passed to the dialog listeners.
 * @returns {void}
 */
export const openModal = (id, detail = {}) => {
  const dialog = document.getElementById(`modal-${id}`);
  if (!(dialog instanceof HTMLDialogElement) || dialog.open) return;

  dialog.dispatchEvent(new CustomEvent('modal:open', { detail }));
  dialog.showModal();
};

/**
 * Checks whether a pointer event happened outside of the dialog box (on the backdrop).
 * @param {HTMLDialogElement} dialog Dialog element.
 * @param {MouseEvent} event Click event.
 * @returns {boolean}
 */
const isBackdropClick = (dialog, { clientX, clientY }) => {
  const rect = dialog.getBoundingClientRect();

  return clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom;
};

/**
 * Wires `[data-modal-open]` triggers, `[data-modal-close]` buttons and backdrop clicks.
 * @returns {void}
 */
export const initModals = () => {
  document.addEventListener('click', (event) => {
    const { target } = event;
    if (!(target instanceof Element)) return;

    const opener = target.closest('[data-modal-open]');
    if (opener instanceof HTMLElement) {
      event.preventDefault();
      openModal(opener.dataset.modalOpen, { ...opener.dataset });
      return;
    }

    if (target.closest('[data-modal-close]')) {
      target.closest('dialog')?.close();
      return;
    }

    if (target instanceof HTMLDialogElement && target.open && isBackdropClick(target, event)) {
      target.close();
    }
  });
};
