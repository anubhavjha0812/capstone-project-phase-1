import React, { useState, useContext } from "react";
import "../App.css";
import LoginVector from "../assets/LoginVector.png";
import { UserContext } from "../context/UserContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Trans, useI18n } from "../i18n/I18nContext";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { setUserInfo } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  // Page the user tried to open before being sent to Log In
  const from = location.state?.from || "/";
  const { t, dir } = useI18n();

  async function login(e) {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    // Client-side validation
    if (!cleanEmail || !password) {
      toast.error(t("auth.fillAll"));
      return;
    }

    // Email format validation including the presence of "@"
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error(t("auth.invalidEmail"));
      return;
    }

    try {
      const response = await fetch("http://localhost:8080/api/v1/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, password }),
        credentials: "include",
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        // Ignored
      }

      if (!response.ok) {
        toast.error(
          response.status === 401
            ? t("auth.loginFailed")
            : data.message || `Login failed (HTTP ${response.status}). Please try again.`
        );
        return;
      }

      setUserInfo(data.data?.user);
      toast.success(t("auth.loginOk"));

      // Delay navigation to show the toast
      setTimeout(() => {
        navigate(from, { replace: true });
      }, 1000);
    } catch (error) {
      console.error("Error:", error);
      toast.error(t("common.serverDown"));
    }
  }

  return (
    <div className="login-page">
      <ToastContainer
        position="top-right"
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={dir === "rtl"}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <div className="login-container">
        <div className="login-form-container">
          <h2 className="login-title">{t("auth.loginTitle")}</h2>
          <form className="login-form" onSubmit={login}>
            <input
              type="email"
              placeholder={t("auth.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder={t("auth.password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div style={{ textAlign: "end", margin: "-8px 0 14px 0" }}>
              <Link
                to="/forgot-password"
                style={{
                  color: "#3182ce",
                  fontSize: "0.88rem",
                  textDecoration: "none",
                }}
              >
                {t("auth.forgot")}
              </Link>
            </div>
            <button type="submit" className="login-button">
              {t("auth.loginTitle")}
            </button>
          </form>
          <div className="login-footer">
            <p>
              <Trans k="auth.noAccount" components={{ link: <Link to="/signup" state={location.state} /> }} />
            </p>
            <p>
              <Link to="/privacy-policy">{t("auth.privacyPolicy")}</Link>
            </p>
          </div>
        </div>
        <div className="login-image">
          <img src={LoginVector} alt="Login Vector" />
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
