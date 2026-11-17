/**
 * Marks a control as invalid and shows the message under it.
 * @param {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} control Form control.
 * @param {string} text Error message.
 * @returns {void}
 */
export const setFieldError = (control, text) => {
  const field = control.closest('.field');
  if (!field) return;

  const errorId = `${control.id}-error`;
  let error = field.querySelector('.field-error');

  if (!error) {
    error = document.createElement('p');
    error.className = 'field-error';
    error.id = errorId;
    field.append(error);
  }

  error.textContent = text;
  field.classList.add('is-invalid');
  control.setAttribute('aria-invalid', 'true');
  control.setAttribute('aria-describedby', errorId);
};

/**
 * Removes the invalid state and the message from a control.
 * @param {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} control Form control.
 * @returns {void}
 */
export const clearFieldError = (control) => {
  const field = control.closest('.field');
  if (!field) return;

  field.classList.remove('is-invalid');
  field.querySelector('.field-error')?.remove();
  control.removeAttribute('aria-invalid');
  control.removeAttribute('aria-describedby');
};
