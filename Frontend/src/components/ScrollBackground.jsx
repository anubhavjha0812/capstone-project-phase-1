import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Page background blends from white (top of page) to the navbar's blue (bottom of page)
const START = [255, 255, 255]; // #ffffff
const END = [154, 217, 255]; // #9AD9FF, same as .navbar

function ScrollBackground() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Browsers fire scroll events at most once per frame, so no extra throttling is needed
    const update = () => {
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const progress =
        maxScroll > 0 ? Math.min(Math.max(window.scrollY / maxScroll, 0), 1) : 0;
      const [r, g, b] = START.map((s, i) =>
        Math.round(s + (END[i] - s) * progress)
      );
      document.body.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
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

  return null;
}

export default ScrollBackground;
