import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { FaBolt, FaHeartbeat, FaStethoscope } from "react-icons/fa";
import { useI18n } from "../i18n/I18nContext";
import { UserContext } from "../context/UserContext";

// Decorative background: flowing lines, dots and a "star of life" (medical asterisk)
function HeroArt() {
  return (
    <div className="home-hero__art" aria-hidden="true">
      <svg viewBox="0 0 800 700" preserveAspectRatio="xMaxYMid slice">
        <g fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round">
          <path d="M520 0 C 640 40, 760 90, 820 120" />
          <path d="M820 230 C 600 220, 470 215, 440 228 C 410 245, 560 320, 820 420" />
          <path d="M820 520 C 660 470, 420 400, 300 392 C 250 390, 270 420, 330 450 C 470 520, 680 620, 820 690" />
          <path d="M820 620 C 600 540, 300 470, 230 480 C 180 490, 240 540, 420 620 C 560 680, 680 700, 760 720" />
          <path d="M240 730 C 220 640, 250 610, 320 610 C 420 610, 560 640, 820 720" />
        </g>
        <g fill="#ffffff">
          <circle cx="710" cy="175" r="22" />
          <circle cx="690" cy="545" r="13" />
          <circle cx="250" cy="595" r="8" />
        </g>
        {/* Star of life: three rounded bars rotated 60° apart */}
        <g transform="translate(470 600)" fill="#fbf8a6">
          <rect x="-24" y="-82" width="48" height="164" rx="8" />
          <rect x="-24" y="-82" width="48" height="164" rx="8" transform="rotate(60)" />
          <rect x="-24" y="-82" width="48" height="164" rx="8" transform="rotate(-60)" />
        </g>
      </svg>
      <span className="home-hero__bubble home-hero__bubble--yellow">
        <FaHeartbeat />
      </span>
      <span className="home-hero__bubble home-hero__bubble--soft">
        <FaStethoscope />
      </span>
    </div>
  );
}

function Hero() {
  const { t } = useI18n();
  const { userInfo } = useContext(UserContext);
  const navigate = useNavigate();

  // Logged-in users go straight to the predictors; everyone else to Log In
  const getStarted = () => navigate(userInfo?.username ? "/predictors" : "/login");

  return (
    <section className="home-hero">
      <div className="home-hero__card">
        <div className="home-hero__content">
          <span className="home-hero__badge">
            <span className="home-hero__badge-icon">
              <FaBolt />
            </span>
            {t("home.badge")}
          </span>
          <h1 className="home-hero__title">{t("home.title")}</h1>
          <hr className="home-hero__divider" />
          <p className="home-hero__subtitle">{t("home.subtitle")}</p>
          <button type="button" className="home-hero__cta" onClick={getStarted}>
            {t("home.cta")}
          </button>
        </div>
        <HeroArt />
      </div>
    </section>
  );
}

export default Hero;
