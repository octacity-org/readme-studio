import { createEffect, createSignal, onSettled, type ParentProps } from 'solid-js';
import { clampWidgetPosition, type WidgetPosition } from '../lib/workspace-widgets';

interface FloatingWidgetProps extends ParentProps {
  readonly title: string;
  readonly position?: WidgetPosition;
  readonly onClose: () => void;
  readonly compact?: boolean;
}

export function FloatingWidget(props: FloatingWidgetProps) {
  let widget: HTMLElement | undefined;
  let drag: { x: number; y: number; left: number; top: number } | undefined;
  const [position, setPosition] = createSignal({ left: 270, top: 100 });

  createEffect(() => props.position, (initial) => {
    if (initial) move(initial.left, initial.top);
  });

  function move(left: number, top: number): void {
    const rect = widget?.getBoundingClientRect();
    setPosition(clampWidgetPosition({ left, top }, {
      width: rect?.width ?? 340,
      height: rect?.height ?? 300,
    }, { width: window.innerWidth, height: window.innerHeight },
    (document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 62) + 8));
  }

  onSettled(() => {
    const initial = props.position ?? position();
    move(initial.left, initial.top);
    const resize = () => move(position().left, position().top);
    window.addEventListener('resize', resize);
    const observer = new ResizeObserver(resize);
    if (widget) observer.observe(widget);
    return () => { window.removeEventListener('resize', resize); observer.disconnect(); };
  });

  return (
    <section
      ref={widget}
      class={['floating-widget', { compact: Boolean(props.compact) }]}
      role="region"
      aria-label={`${props.title} widget`}
      style={{ left: `${position().left}px`, top: `${position().top}px` }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); props.onClose(); }
      }}
    >
      <header class="widget-header">
        <button
          type="button"
          class="widget-grip"
          aria-label={`Move ${props.title} widget`}
          title="Drag to move · arrow keys to reposition"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            drag = { x: event.clientX, y: event.clientY, ...position() };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (drag) move(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
          }}
          onPointerUp={() => { drag = undefined; }}
          onPointerCancel={() => { drag = undefined; }}
          onKeyDown={(event) => {
            const steps: Record<string, readonly [number, number]> = {
              ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16],
            };
            const step = steps[event.key];
            if (!step) return;
            event.preventDefault();
            move(position().left + step[0], position().top + step[1]);
          }}
        ><span aria-hidden="true">⠿</span><strong>{props.title}</strong></button>
        <button type="button" class="widget-close" aria-label={`Close ${props.title} widget`} onClick={props.onClose}>×</button>
      </header>
      <div class="widget-content">{props.children}</div>
    </section>
  );
}
