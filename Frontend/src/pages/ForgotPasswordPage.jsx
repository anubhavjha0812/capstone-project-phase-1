import React, { useState, useContext, useEffect } from "react";
import "../App.css";
import LoginVector from "../assets/LoginVector.png";
import { UserContext } from "../context/UserContext";
import { useNavigate, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Trans, useI18n } from "../i18n/I18nContext";

function ForgotPasswordPage() {
  const { userInfo } = useContext(UserContext);
  const navigate = useNavigate();
  const { t, dir } = useI18n();

  const [step, setStep] = useState(1); // Step 1: Send OTP, Step 2: Verify & Reset
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // If user is already logged in, autofill their email
  useEffect(() => {
    const userEmail = userInfo?.email;
    if (userEmail) {
      setEmail(userEmail);
    }
  }, [userInfo]);

  const handleSendOtp = async (e) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error(t("auth.enterEmail"));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      toast.error(t("auth.invalidEmail"));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("http://localhost:8080/api/v1/users/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: cleanEmail }),
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        // Ignored
      }

      if (!response.ok) {
        toast.error(
          response.status === 404
            ? t("auth.noAccountEmail")
            : data.message || `${t("auth.otpFailed")} (HTTP ${response.status})`
        );
        return;
      }

      toast.success(t("auth.otpSent"));
      setStep(2);
    } catch (error) {
      console.error("Error sending OTP:", error);
      toast.error(t("common.serverDown"));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.trim();

    if (!cleanOtp || !newPassword || !confirmPassword) {
      toast.error(t("auth.fillAll"));
      return;
    }

    if (!/^\d{6}$/.test(cleanOtp)) {
      toast.error(t("auth.otpInvalid"));
      return;
    }

    if (newPassword.length < 6) {
      toast.error(t("auth.newPasswordShort"));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t("auth.mismatch"));
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        "http://localhost:8080/api/v1/users/reset-password-otp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: cleanEmail, otp: cleanOtp, newPassword }),
        }
      );

      let data = {};
      try {
        data = await response.json();
      } catch {
        // Ignored
      }

      if (!response.ok) {
        toast.error(
          response.status === 429
            ? t("auth.otpTooMany")
            : data.message || `${t("auth.resetFailed")} (HTTP ${response.status})`
        );
        return;
      }

      toast.success(t("auth.resetOk"));
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (error) {
      console.error("Error resetting password:", error);
      toast.error(t("common.serverDown"));
    } finally {
      setLoading(false);
    }
  };

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
          <h2 className="login-title">
            {step === 1 ? t("auth.resetTitle") : t("auth.otpTitle")}
          </h2>

          <p
            style={{
              color: "#718096",
              fontSize: "0.95rem",
              marginBottom: "20px",
              textAlign: "center",
            }}
          >
            {step === 1
              ? t("auth.resetIntro")
              : t("auth.otpIntro", { email })}
          </p>

          {step === 1 ? (
            <form className="login-form" onSubmit={handleSendOtp}>
              <input
                type="email"
                placeholder={t("auth.registeredEmail")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button
                type="submit"
                className="login-button"
                disabled={loading}
                style={{ opacity: loading ? 0.7 : 1 }}
              >
                {loading ? t("auth.sendingOtp") : t("auth.sendOtp")}
              </button>
            </form>
          ) : (
            <form className="login-form" onSubmit={handleResetPassword}>
              <input
                type="text"
                placeholder={t("auth.otpPlaceholder")}
                value={otp}
                maxLength={6}
                onChange={(e) => setOtp(e.target.value)}
                style={{
                  letterSpacing: "4px",
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                  textAlign: "center",
                }}
                required
              />
              <input
                type="password"
                placeholder={t("auth.newPassword")}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder={t("auth.confirmPassword")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="submit"
                className="login-button"
                disabled={loading}
                style={{ opacity: loading ? 0.7 : 1 }}
              >
                {loading ? t("auth.updating") : t("auth.changePassword")}
              </button>

              <div style={{ textAlign: "center", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#3182ce",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    textDecoration: "underline",
                  }}
                >
                  {t("auth.resend")}
                </button>
              </div>
            </form>
          )}

          <div className="login-footer">
            <p>
              <Trans k="auth.remembered" components={{ link: <Link to="/login" /> }} />
            </p>
          </div>
        </div>
        <div className="login-image">
          <img src={LoginVector} alt="Password Reset" />
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;

