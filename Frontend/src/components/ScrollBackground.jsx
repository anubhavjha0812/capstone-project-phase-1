import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

// The page background blends from white (top of page) to the navbar's blue (bottom of page).
// A fixed blue layer behind the content fades in with the scroll position; changing only its
// opacity is handled by the GPU, whereas recolouring the body repaints the whole page every frame.
function ScrollBackground() {
  const { pathname } = useLocation();
  const layer = useRef(null);

  useEffect(() => {
    let last = -1;
    const update = () => {
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress =
        maxScroll > 0 ? Math.min(Math.max(window.scrollY / maxScroll, 0), 1) : 0;
      if (Math.abs(progress - last) < 0.002) return;
      last = progress;
      if (layer.current) layer.current.style.opacity = progress.toFixed(3);
    };

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // Page height changes (images loading, FAQ answers opening) change the scroll range
    const observer = new ResizeObserver(update);
    observer.observe(document.body);

    update();

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, [pathname]);

  return <div ref={layer} className="scroll-bg" aria-hidden="true" />;
}

export default ScrollBackground;
