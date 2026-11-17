import { clearFieldError, setFieldError } from './field.js';

const DEFAULT_MAX_FILES = 5;
const DEFAULT_MAX_MB = 10;
const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Checks whether a file looks like an image (HEIC is allowed by extension).
 * @param {File} file File to check.
 * @returns {boolean}
 */
const isImage = (file) => file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);

/**
 * Downscales an image to JPEG in the browser. Returns null if the browser cannot decode it.
 * @param {File} file Image file.
 * @returns {Promise<File | null>}
 */
const compress = async (file) => {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');

    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
    });
    if (!blob) return null;

    return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' });
  } catch {
    return null;
  }
};

/**
 * Prepares a picked file: filters non-images, compresses and checks the size limit.
 * @param {File} file Picked file.
 * @param {number} maxBytes Size limit in bytes.
 * @returns {Promise<File | null>}
 */
const prepare = async (file, maxBytes) => {
  if (!isImage(file)) return null;

  const result = (await compress(file)) ?? file;

  return result.size <= maxBytes ? result : null;
};

/**
 * Builds a list item for a selected file.
 * @param {File} file Selected file.
 * @param {number} index File index.
 * @returns {HTMLLIElement}
 */
const renderChip = (file, index) => {
  const item = document.createElement('li');
  const name = document.createElement('span');
  const remove = document.createElement('button');

  name.textContent = file.name;
  remove.type = 'button';
  remove.textContent = '×';
  remove.dataset.index = String(index);
  remove.setAttribute('aria-label', `Удалить файл ${file.name}`);
  item.append(name, remove);

  return item;
};

/**
 * Turns a file input into a multi-file picker with previews in a chip list.
 * Selected images are downscaled in the browser before sending.
 * @param {HTMLFormElement} form Form element.
 * @param {HTMLInputElement} input File input inside a `.field`.
 * @returns {void}
 */
const setupUpload = (form, input) => {
  const field = input.closest('.field');
  const pick = field.querySelector('.field-pick');
  const list = field.querySelector('.field-files');
  const maxFiles = Number(input.dataset.maxFiles) || DEFAULT_MAX_FILES;
  const maxBytes = (Number(input.dataset.maxSize) || DEFAULT_MAX_MB) * 1024 * 1024;
  let files = [];

  const sync = () => {
    const transfer = new DataTransfer();

    files.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
    field.classList.toggle('has-files', files.length > 0);
    list.replaceChildren(...files.map(renderChip));
  };

  pick.addEventListener('click', () => input.click());

  input.addEventListener('change', async (event) => {
    /* Ignore the synthetic event dispatched after removing a file */
    if (!event.isTrusted) return;

    const picked = Array.from(input.files);
    const prepared = (await Promise.all(picked.map((file) => prepare(file, maxBytes)))).filter(
      Boolean
    );
    const room = maxFiles - files.length;

    files = [...files, ...prepared.slice(0, room)];
    sync();

    if (prepared.length < picked.length) {
      setFieldError(input, 'Не удалось обработать часть файлов: нужны фото до 10 МБ');
    } else if (prepared.length > room) {
      setFieldError(input, `Можно прикрепить не больше ${maxFiles} файлов`);
    } else {
      clearFieldError(input);
    }
  });

  list.addEventListener('click', (event) => {
    const remove = event.target.closest('button[data-index]');
    if (!remove) return;

    files = files.filter((_, index) => index !== Number(remove.dataset.index));
    sync();
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  form.addEventListener('reset', () => {
    files = [];
    sync();
  });
};

/**
 * Initializes all file pickers of a form.
 * @param {HTMLFormElement} form Form element.
 * @returns {void}
 */
export const initUploads = (form) => {
  form.querySelectorAll('input[type="file"]').forEach((input) => setupUpload(form, input));
};
