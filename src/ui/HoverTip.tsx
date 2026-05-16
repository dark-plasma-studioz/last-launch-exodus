import { createPortal } from "react-dom";
import { useRef, useState, type ReactElement, type ReactNode } from "react";

/** Tooltip that renders in a portal so it isn't clipped by sidebar overflow. */
export function HoverTip(props: {
  tip: string;
  children: ReactNode;
  className?: string;
}): ReactElement {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const show = () => {
    const el = anchorRef.current;
    if (!el || !props.tip) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.top - 6, left: r.left + r.width / 2 });
    setVisible(true);
  };

  return (
    <>
      <span
        ref={anchorRef}
        className={props.className ?? "hover-tip-anchor"}
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
        onFocus={show}
        onBlur={() => setVisible(false)}
        tabIndex={props.tip ? 0 : undefined}
      >
        {props.children}
      </span>
      {visible && props.tip
        ? createPortal(
            <div
              className="hover-tip-popup"
              role="tooltip"
              style={{
                top: pos.top,
                left: pos.left,
                transform: "translate(-50%, -100%)",
              }}
            >
              {props.tip}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
