/**
 * Проверяет, что popover реализован через элемент `details`.
 * @param {HTMLElement} popover Popover-элемент.
 * @returns {boolean} `true`, если это `details`.
 */
const isDetailsPopover = (popover) => popover.tagName.toLowerCase() === 'details';

const popoverRegistry = new Set();
let globalHandlersBound = false;

/**
 * Возвращает текущее состояние popover.
 * @param {HTMLElement} popover Popover-элемент.
 * @returns {boolean} `true`, если popover открыт.
 */
const isPopoverOpen = (popover) =>
  isDetailsPopover(popover) ? popover.hasAttribute('open') : popover.classList.contains('is-open');

/**
 * Переключает состояние popover.
 * @param {HTMLElement} popover Popover-элемент.
 * @param {boolean} isOpen Желаемое состояние открытия.
 * @returns {void}
 */
const setPopoverState = (popover, isOpen) => {
  const summary = popover.querySelector('[data-role="popover-summary"], summary');
  const body = popover.querySelector('.body');

  if (isDetailsPopover(popover)) {
    if (isOpen) {
      popover.setAttribute('open', '');
    } else {
      popover.removeAttribute('open');
    }

    return;
  }

  if (isOpen) {
    popover.classList.add('is-open');
  } else {
    popover.classList.remove('is-open');
  }

  if (summary && body) {
    summary.setAttribute('aria-expanded', isOpen.toString());
    body.setAttribute('aria-hidden', (!isOpen).toString());
  }
};

/**
 * Обновляет ARIA-атрибуты для кастомных popover без `details`.
 * @returns {void}
 */
const updateAriaAttributes = () => {
  popoverRegistry.forEach((popover) => {
    if (isDetailsPopover(popover)) return;

    const summary = popover.querySelector('[data-role="popover-summary"], summary');
    const body = popover.querySelector('.body');

    if (!(summary instanceof HTMLElement) || !(body instanceof HTMLElement)) return;

    if (!body.id) {
      body.id = `popover-content-${Math.random().toString(36).substring(2, 10)}`;
    }

    summary.setAttribute('aria-haspopup', 'true');
    summary.setAttribute('aria-controls', body.id);
    summary.setAttribute('role', 'button');

    if (!summary.hasAttribute('tabindex')) {
      summary.setAttribute('tabindex', '0');
    }

    const isOpen = isPopoverOpen(popover);
    summary.setAttribute('aria-expanded', isOpen.toString());
    body.setAttribute('aria-hidden', (!isOpen).toString());
  });
};

/**
 * Закрывает все popover, кроме исключённого.
 * @param {HTMLElement | null} [exclude=null] Popover, который нужно оставить открытым.
 * @returns {void}
 */
const closeAllPopovers = (exclude = null) => {
  popoverRegistry.forEach((popover) => {
    if (popover !== exclude) {
      setPopoverState(popover, false);
    }
  });
};

/**
 * Закрывает popover при клике вне компонента.
 * @param {MouseEvent} event Событие клика.
 * @returns {void}
 */
const handleDocumentClick = (event) => {
  popoverRegistry.forEach((popover) => {
    if (!popover.contains(event.target)) {
      setPopoverState(popover, false);
    }
  });
};

/**
 * Закрывает все popover по клавише Escape.
 * @param {KeyboardEvent} event Событие клавиатуры.
 * @returns {void}
 */
const handleKeydown = (event) => {
  if (event.key === 'Esc' || event.key === 'Escape') {
    closeAllPopovers();
  }
};

/**
 * Инициализирует popover-компоненты playground.
 * @returns {void}
 */
export default function initPopovers() {
  const popovers = Array.from(document.querySelectorAll('[data-role="popover"]'));

  if (!popovers.length) return;

  popovers.forEach((popover) => {
    if (!(popover instanceof HTMLElement) || popoverRegistry.has(popover)) return;

    popoverRegistry.add(popover);

    const summary = popover.querySelector('[data-role="popover-summary"], summary');
    if (!(summary instanceof HTMLElement)) return;

    summary.addEventListener('click', (event) => {
      const isDetails = isDetailsPopover(popover);
      const wasOpen = isPopoverOpen(popover);

      if (!isDetails) {
        event.preventDefault();
      }

      if (!wasOpen) {
        closeAllPopovers(popover);
      }

      if (!isDetails) {
        setPopoverState(popover, !wasOpen);
      }

      event.stopPropagation();
    });

    if (!isDetailsPopover(popover)) {
      summary.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          summary.click();
        }
      });
    }
  });

  updateAriaAttributes();

  if (!globalHandlersBound) {
    document.addEventListener('click', handleDocumentClick);
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('resize', updateAriaAttributes);
    globalHandlersBound = true;
  }
}
