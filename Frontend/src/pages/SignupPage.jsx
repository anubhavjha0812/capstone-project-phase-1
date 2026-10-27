import React, { useState, useContext } from "react";
import "../App.css";
import SignupVector from "../assets/SignupVector.png";
import { UserContext } from "../context/UserContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Trans, useI18n } from "../i18n/I18nContext";

function SignupPage() {
  const [fullname, setFullname] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { setUserInfo } = useContext(UserContext);
  const navigate = useNavigate();
  const location = useLocation();
  // Page the user tried to open before being sent to Log In / Sign Up
  const from = location.state?.from || "/";
  const { t, dir } = useI18n();

  async function signup(e) {
    e.preventDefault();

    const cleanFullname = fullname.trim();
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    // Client-side validation
    if (!cleanFullname || !cleanUsername || !cleanEmail || !password) {
      toast.error(t("auth.fillAll"));
      return;
    }

    // Fullname validation (example: must be at least 3 characters)
    if (cleanFullname.length < 3) {
      toast.error(t("auth.fullNameShort"));
      return;
    }

    // Username validation (example: must be alphanumeric and between 3-20 characters)
    const usernameRegex = /^[a-zA-Z0-9]{3,20}$/;
    if (!usernameRegex.test(cleanUsername)) {
      toast.error(t("auth.usernameInvalid"));
      return;
    }

    // Email format validation including the presence of "@"
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error(t("auth.invalidEmail"));
      return;
    }

    // Password validation (example: must be at least 6 characters)
    if (password.length < 6) {
      toast.error(t("auth.passwordShort"));
      return;
    }

    try {
      const response = await fetch(
        "http://localhost:8080/api/v1/users/register",
        {
          method: "POST",
          body: JSON.stringify({
            fullname: cleanFullname,
            username: cleanUsername,
            email: cleanEmail,
            password,
          }),
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }
      );

      let data = {};
      try {
        data = await response.json();
      } catch {
        // Ignored
      }

      if (!response.ok) {
        // e.g. 409: "User with email or username already exists"
        toast.error(
          response.status === 409
            ? t("auth.signupExists")
            : data.message || `Signup failed (HTTP ${response.status}). Please try again.`
        );
        return;
      }

      setUserInfo(data.data?.user);
      toast.success(t("auth.signupOk"));

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
    <div className="signup-page">
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={dir === "rtl"}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      <div className="signup-container">
        <div className="signup-form-container">
          <h2 className="signup-title">{t("auth.signupTitle")}</h2>
          <form className="signup-form" onSubmit={signup}>
            <input
              type="text"
              placeholder={t("auth.fullName")}
              value={fullname}
              onChange={(e) => setFullname(e.target.value)}
            />
            <input
              type="text"
              placeholder={t("auth.username")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
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
            <button type="submit" className="signup-button">
              {t("auth.signupTitle")}
            </button>
          </form>
          <div className="signup-footer">
            <p>
              <Trans k="auth.haveAccount" components={{ link: <Link to="/login" state={location.state} /> }} />
            </p>
            <p>
              <Trans
                k="auth.agree"
                components={{ link: <Link to="/privacy-policy" /> }}
              />
            </p>
          </div>
        </div>
        <div className="signup-image">
          <img src={SignupVector} alt="Signup Vector" />
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
