import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { FaBars, FaTimes, FaChevronDown } from "react-icons/fa";
import { UserContext } from "../context/UserContext";
import logoIcon from "../assets/LogoIcon.png";
import LanguageSwitcher from "./LanguageSwitcher";
import { useI18n } from "../i18n/I18nContext";

// True when the row of links runs past the navbar or into the logo
const rowOverflows = (nav) => {
  const logo = nav.querySelector(".navbar-logo").getBoundingClientRect();
  const links = nav.querySelector(".navbar-links").getBoundingClientRect();
  const gap = 8;
  const overlapsLogo =
    links.left < logo.right + gap && links.right > logo.left - gap;
  return nav.scrollWidth > nav.clientWidth + 1 || overlapsLogo;
};

const navLinks = [
  { to: "/", key: "nav.home" },
  { to: "/predictors", key: "nav.predictors" },
  { to: "/about-predictix", key: "nav.aboutPredictix" },
  { to: "/integration", key: "nav.integration" },
  { to: "/faqs", key: "nav.faqs" },
];

function Navbar() {
  const { userInfo, setUserInfo } = useContext(UserContext);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const { t, language } = useI18n();

  // "compact" = links moved into the ☰ menu because the full row doesn't fit.
  // Decided by measuring, because the row's width depends on the language and login state.
  const navRef = useRef(null);
  const [compact, setCompact] = useState(false);
  const compactRef = useRef(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const fullRowWidth = useRef(0);
  compactRef.current = compact;

  useEffect(() => {
    fetchProfile();
  }, []);

  // Close the account menu on outside click or Escape
  useEffect(() => {
    if (!userMenuOpen) return undefined;
    const onClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenuOpen]);

  // Glass effect: once the page is scrolled a little, the bar turns from solid blue into
  // see-through frosted white. Only a class is toggled (CSS transitions the colour), so
  // scrolling does no per-frame style work.
  useEffect(() => {
    let scrolled = null;
    const update = () => {
      const next = window.scrollY > 24;
      if (next === scrolled) return;
      scrolled = next;
      navRef.current?.classList.toggle("is-scrolled", next);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  // Re-measure the full row whenever its text changes
  useLayoutEffect(() => {
    setCompact(false);
  }, [language, userInfo?.username]);

  // After each render in full-row mode, switch to compact if the row doesn't fit
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!compact && nav && rowOverflows(nav)) {
      fullRowWidth.current = nav.scrollWidth;
      setCompact(true);
    }
  });

  // React to window resizes and late font loading
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;

    const check = () => {
      if (!compactRef.current) {
        if (rowOverflows(nav)) {
          fullRowWidth.current = nav.scrollWidth;
          setCompact(true);
        }
      } else if (nav.clientWidth >= fullRowWidth.current + 16) {
        setCompact(false); // enough room again; the layout effect re-checks
        setIsMobile(false);
      }
    };

    const observer = new ResizeObserver(check);
    observer.observe(nav);
    observer.observe(nav.querySelector(".navbar-links"));
    return () => observer.disconnect();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch(
        "http://localhost:8080/api/v1/users/profile",
        {
          credentials: "include",
        }
      );
      if (response.ok) {
        const userData = await response.json();
        setUserInfo(userData.data);
      } else if (response.status === 401) {
        // Session missing or expired: clear user
        setUserInfo(null);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const logout = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setUserMenuOpen(false);
    try {
      await fetch("http://localhost:8080/api/v1/users/logout", {
        credentials: "include",
        method: "POST",
      });
    } catch (error) {
      console.error("Logout failed with error:", error);
    } finally {
      // Clear React state and browser localStorage
      setUserInfo(null);
      if (isMobile) {
        setIsMobile(false);
      }
      navigate("/login");
    }
  };

  const username = userInfo?.username;

  const isLoggedIn = Boolean(username);

  // Logged-out visitors only see Log In / Sign Up (all other pages require login)
  const visibleLinks = isLoggedIn ? navLinks : [];

  const toggleMobileMenu = () => {
    setIsMobile(!isMobile);
  };

  const handleLinkClick = () => {
    setUserMenuOpen(false);
    if (isMobile) {
      setIsMobile(false);
    }
  };

  return (
    <nav ref={navRef} className={`navbar ${compact ? "compact" : ""}`}>
      <Link to="/" className="navbar-logo" onClick={handleLinkClick}>
        <img src={logoIcon} alt="" />
        <span className="navbar-brand">Predictix</span>
      </Link>
      <div className={`navbar-links ${isMobile ? "active" : ""}`}>
        {visibleLinks.map(({ to, key }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              isActive ? "navbar-link active" : "navbar-link"
            }
            onClick={handleLinkClick}
          >
            {t(key)}
          </NavLink>
        ))}
        {isLoggedIn ? (
          <div className="user-menu" ref={userMenuRef}>
            <button
              type="button"
              className="user-menu__button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-haspopup="true"
              aria-expanded={userMenuOpen}
              title={t("nav.account")}
            >
              <span className="user-menu__avatar" aria-hidden="true">
                {(userInfo.fullname || username).trim().charAt(0).toUpperCase()}
              </span>
              <span className="user-menu__name">{userInfo.fullname || username}</span>
              <FaChevronDown className="user-menu__chevron" aria-hidden="true" />
            </button>
            <div className={`user-menu__panel ${userMenuOpen ? "open" : ""}`} role="menu">
              <div className="user-menu__who">
                <strong>{userInfo.fullname || username}</strong>
                {userInfo.email && <span>{userInfo.email}</span>}
              </div>
              <NavLink to="/account" role="menuitem" className="user-menu__item" onClick={handleLinkClick}>
                {t("nav.account")}
              </NavLink>
              <NavLink to="/forgot-password" role="menuitem" className="user-menu__item" onClick={handleLinkClick}>
                {t("nav.changePassword")}
              </NavLink>
              <button type="button" role="menuitem" className="user-menu__item user-menu__logout" onClick={logout}>
                {t("nav.logout")}
              </button>
            </div>
          </div>
        ) : (
          <div className="navbar-auth">
            <NavLink
              to="/login"
              className="btn btn-login"
              onClick={handleLinkClick}
            >
              {t("nav.login")}
            </NavLink>
            <NavLink
              to="/signup"
              className="btn btn-signup"
              onClick={handleLinkClick}
            >
              {t("nav.signup")}
            </NavLink>
          </div>
        )}
      </div>
      <LanguageSwitcher />
      <div className="hamburger" onClick={toggleMobileMenu} aria-label={t("nav.menu")} aria-expanded={isMobile} role="button">
        {isMobile ? <FaTimes size={22} /> : <FaBars size={22} />}
      </div>
    </nav>
  );
}

export default Navbar;
