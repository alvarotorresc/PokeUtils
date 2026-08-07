// ===== TOOLTIP =====
//
// A text bubble anchored to an element. Works with a pointer and with touch:
// there is no hover on mobile, so a tap toggles the bubble and a tap outside
// closes it.

let openBubble = null;

function closeBubble() {
  if (openBubble) {
    openBubble.remove();
    openBubble = null;
  }
}

document.addEventListener('click', (e) => {
  if (openBubble && !e.target.closest('[data-tooltip-anchor]')) closeBubble();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeBubble();
});

// Returns a function that detaches the listeners.
export function attachTooltip(element, text) {
  if (!text) return () => {};
  element.setAttribute('data-tooltip-anchor', '');
  if (!element.hasAttribute('tabindex') && element.tagName !== 'A' && element.tagName !== 'BUTTON') {
    element.setAttribute('tabindex', '0');
  }

  const show = () => {
    closeBubble();
    const bubble = document.createElement('div');
    bubble.className = 'tooltip-bubble';
    bubble.setAttribute('role', 'tooltip');
    bubble.textContent = text;
    element.appendChild(bubble);
    openBubble = bubble;
  };

  // The anchor is also a link to the ability page. On a pointer device hover
  // shows the bubble and a click navigates, as usual. On touch there is no
  // hover, so the first tap shows the bubble instead of navigating and a
  // second tap on the same element follows the link.
  let lastPointerWasTouch = false;
  const onPointerDown = (e) => { lastPointerWasTouch = e.pointerType === 'touch'; };

  const onClick = (e) => {
    if (!lastPointerWasTouch) return; // let the link do its job
    const yaAbierta = openBubble && element.contains(openBubble);
    if (yaAbierta) return; // second tap navigates
    e.preventDefault();
    e.stopPropagation();
    show();
  };

  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('mouseenter', show);
  element.addEventListener('mouseleave', closeBubble);
  element.addEventListener('focus', show);
  element.addEventListener('blur', closeBubble);
  element.addEventListener('click', onClick);

  return () => {
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('mouseenter', show);
    element.removeEventListener('mouseleave', closeBubble);
    element.removeEventListener('focus', show);
    element.removeEventListener('blur', closeBubble);
    element.removeEventListener('click', onClick);
  };
}
