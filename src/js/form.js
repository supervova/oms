import { clearFieldError, setFieldError } from './field.js';
import { initUploads } from './upload.js';

const ERROR_REQUIRED = 'Заполни это поле';
const ERROR_CONSENT = 'Нужно согласие';
const ERROR_FORMAT = 'Проверь значение';

/**
 * Returns the error text for an invalid control.
 * @param {HTMLInputElement | HTMLSelectElement} control Form control.
 * @returns {string}
 */
const getErrorText = (control) => {
  if (control.dataset.error) return control.dataset.error;
  if (!control.validity.valueMissing) return ERROR_FORMAT;

  return control.type === 'checkbox' ? ERROR_CONSENT : ERROR_REQUIRED;
};

/**
 * Validates all controls and returns the first invalid one.
 * @param {HTMLFormElement} form Form element.
 * @returns {HTMLInputElement | HTMLSelectElement | null}
 */
const validate = (form) => {
  const controls = Array.from(form.elements).filter((element) => element.willValidate);
  let firstInvalid = null;

  controls.forEach((control) => {
    if (control.validity.valid) {
      clearFieldError(control);
      return;
    }

    setFieldError(control, getErrorText(control));
    firstInvalid ??= control;
  });

  return firstInvalid;
};

/**
 * Rebuilds the size list from the selected product's `data-sizes`.
 * The size field is hidden and disabled when the product has no sizes.
 * @param {HTMLFormElement} form Form element.
 * @returns {void}
 */
const syncSizes = (form) => {
  const product = form.elements.namedItem('product');
  const size = form.elements.namedItem('size');
  if (!(product instanceof HTMLSelectElement) || !(size instanceof HTMLSelectElement)) return;

  const sizes = (product.selectedOptions[0]?.dataset.sizes ?? '').split(',').filter(Boolean);
  const placeholder = new Option('', '', true, true);
  placeholder.disabled = true;
  placeholder.hidden = true;

  size.replaceChildren(placeholder, ...sizes.map((value) => new Option(value, value)));
  size.disabled = sizes.length === 0;
  size.closest('.field').hidden = sizes.length === 0;
  clearFieldError(size);
};

/**
 * Shows or hides fields with `data-visible-when="name=value"` and disables their controls.
 * @param {HTMLFormElement} form Form element.
 * @returns {void}
 */
const syncConditional = (form) => {
  form.querySelectorAll('[data-visible-when]').forEach((field) => {
    const [name, value] = field.dataset.visibleWhen.split('=');
    const visible = form.elements.namedItem(name)?.value === value;

    field.hidden = !visible;
    field.querySelectorAll('input, select, textarea').forEach((control) => {
      control.disabled = !visible;
      if (!visible) clearFieldError(control);
    });
  });
};

/**
 * Moves focus to a control (file inputs are hidden, so their button gets the focus).
 * @param {HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement} control Form control.
 * @returns {void}
 */
const focusControl = (control) => {
  const target =
    control.type === 'file' ? control.closest('.field').querySelector('.field-pick') : control;

  target.focus();
};

/**
 * Resets the form to its initial state and applies the preselected product.
 * @param {HTMLDialogElement} dialog Dialog element.
 * @param {HTMLFormElement} form Form element.
 * @param {Record<string, string>} detail Data from the opener.
 * @returns {void}
 */
const resetForm = (dialog, form, detail) => {
  form.reset();
  form.querySelectorAll('.is-invalid').forEach((field) => {
    field.classList.remove('is-invalid');
    field.querySelector('.field-error')?.remove();
  });
  form.querySelector('.form-error').hidden = true;
  form.hidden = false;
  dialog.querySelector('.modal-title').hidden = false;
  dialog.querySelector('.modal-success').hidden = true;

  const product = form.elements.namedItem('product');
  if (product instanceof HTMLSelectElement && detail.product) {
    const match = Array.from(product.options).find((option) => option.value === detail.product);
    if (match) product.value = match.value;
  }

  syncSizes(form);
  syncConditional(form);
};

/**
 * Replaces the form with the success message.
 * @param {HTMLDialogElement} dialog Dialog element.
 * @param {HTMLFormElement} form Form element.
 * @returns {void}
 */
const showSuccess = (dialog, form) => {
  const success = dialog.querySelector('.modal-success');

  form.hidden = true;
  dialog.querySelector('.modal-title').hidden = true;
  success.hidden = false;
  success.querySelector('.modal-success-title').focus();
};

/**
 * Sends the form data to the form action.
 * @param {HTMLDialogElement} dialog Dialog element.
 * @param {HTMLFormElement} form Form element.
 * @returns {Promise<void>}
 */
const submit = async (dialog, form) => {
  const invalid = validate(form);
  if (invalid) {
    focusControl(invalid);
    return;
  }

  const data = new FormData(form);

  /* Honeypot: bots fill the hidden field, show them a fake success */
  if (data.get('website')) {
    showSuccess(dialog, form);
    return;
  }

  data.set('page', window.location.href);
  data.set('lang', document.documentElement.lang);
  form.classList.add('is-loading');
  form.querySelector('.form-error').hidden = true;

  try {
    const response = await fetch(form.action, {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    showSuccess(dialog, form);
  } catch {
    form.querySelector('.form-error').hidden = false;
  } finally {
    form.classList.remove('is-loading');
  }
};

/**
 * Initializes every `.form` inside a `<dialog>`: validation, size list and submit.
 * @param {ParentNode} [root=document] Search scope.
 * @returns {void}
 */
export const initForms = (root = document) => {
  root.querySelectorAll('dialog .form').forEach((form) => {
    const dialog = form.closest('dialog');

    dialog.addEventListener('modal:open', (event) => resetForm(dialog, form, event.detail));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!form.classList.contains('is-loading')) submit(dialog, form);
    });

    form.addEventListener('change', (event) => {
      if (event.target.name === 'product') syncSizes(form);
      syncConditional(form);
    });

    /* Re-check a control as soon as it is edited after an error */
    const recheck = ({ target }) => {
      if (!target.closest('.field')?.classList.contains('is-invalid')) return;
      if (target.validity.valid) clearFieldError(target);
    };

    form.addEventListener('input', recheck);
    form.addEventListener('change', recheck);

    initUploads(form);
    syncSizes(form);
    syncConditional(form);
  });
};
