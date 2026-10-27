import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// React Router keeps the scroll position between pages. Start each new page at
// the top (e.g. after clicking a footer link), or at #section when the link has one.
function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}

export default ScrollToTop;
