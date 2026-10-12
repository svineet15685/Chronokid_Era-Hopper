// Keyboard and touch input, matching the prototype's bindings.
import type { MoveInput } from './simulation';

export interface InputHandlers {
  onJump(): void;
  onEnter(): void;
}

const PREVENT_DEFAULT = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space'];

export function bindInput(touchRoot: ParentNode, handlers: InputHandlers): MoveInput {
  const keys: MoveInput = { left: false, right: false };

  window.addEventListener('keydown', event => {
    if (PREVENT_DEFAULT.includes(event.code)) event.preventDefault();
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') keys.left = true;
    if (event.code === 'ArrowRight' || event.code === 'KeyD') keys.right = true;
    if ((event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') && !event.repeat) handlers.onJump();
    if (event.code === 'Enter') handlers.onEnter();
  });
  window.addEventListener('keyup', event => {
    if (PREVENT_DEFAULT.includes(event.code)) event.preventDefault();
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') keys.left = false;
    if (event.code === 'ArrowRight' || event.code === 'KeyD') keys.right = false;
  });
  window.addEventListener('blur', () => { keys.left = keys.right = false; });

  touchRoot.querySelectorAll<HTMLElement>('[data-control]').forEach(button => {
    const control = button.dataset.control;
    const down = (event: PointerEvent) => {
      event.preventDefault();
      if (control === 'jump') handlers.onJump();
      else if (control === 'left' || control === 'right') keys[control] = true;
      button.setPointerCapture?.(event.pointerId);
    };
    const up = (event: PointerEvent) => {
      event.preventDefault();
      if (control === 'left' || control === 'right') keys[control] = false;
    };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
  });

  return keys;
}
