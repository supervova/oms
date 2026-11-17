/**
 * Syncs every `.compare` block with its range input.
 * @param {ParentNode} [root=document] Search scope.
 * @returns {void}
 */
export const initCompare = (root = document) => {
  root.querySelectorAll('.compare').forEach((el) => {
    const range = el.querySelector('.compare-range');
    if (!range) return;

    const update = () => el.style.setProperty('--compare-pos', `${range.value}%`);

    range.addEventListener('input', update);
    update();
  });
};
