import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import React, { useContext } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ScrollBackground from "./components/ScrollBackground";
import ScrollToTop from "./components/ScrollToTop";
import PredictorsPage from "./pages/PredictorsPage";
import AboutPage from "./pages/AboutPage";
import AboutPredictixPage from "./pages/AboutPredictixPage";
import IntegrationPage from "./pages/IntegrationPage";
import FAQPage from "./pages/FAQPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import ContactPage from "./pages/ContactPage";
import AccountPage from "./pages/AccountPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import HomePage from "./pages/HomePage";
import BreastPage from "./pages/BreastPage";
import LungPage from "./pages/LungPage";
import HeartPage from "./pages/HeartPage";
import DiabetesPage from "./pages/DiabetesPage";
import { UserContextProvider } from "./context/UserContext";
import { I18nProvider } from "./i18n/I18nContext";
import LanguageSwitcher from "./components/LanguageSwitcher";
import RequireAuth from "./components/RequireAuth";
import { UserContext } from "./context/UserContext";
import { useI18n } from "./i18n/I18nContext";
import { FaArrowLeft } from "react-icons/fa";

// Page with the navbar on top; every page gets the footer.
// Pages without the navbar get a floating language switcher instead.
const withLayout = (page, { navbar = true } = {}) => (
  <div>
    {navbar ? <Navbar /> : <LanguageSwitcher floating />}
    {/* Log in / sign up / password pages open with a slow unfold animation */}
    {navbar ? page : <div className="page-unfold">{page}</div>}
    <Footer />
  </div>
);

// Back button for pages opened on their own (without the site navbar)
function BackButton() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/login"));
  return (
    <button type="button" className="standalone-back" onClick={goBack}>
      <FaArrowLeft aria-hidden="true" /> {t("auth.back")}
    </button>
  );
}

// Pages anyone may read (e.g. the Privacy Policy linked from Sign Up).
// Logged-in users see them inside the site; visitors see them on their own,
// so reading them does not open up the rest of the site.
function PublicPage({ children }) {
  const { userInfo } = useContext(UserContext);
  if (userInfo?.username) return withLayout(children);
  return withLayout(
    <>
      <BackButton />
      {children}
    </>,
    { navbar: false }
  );
}

// The landing page is open to everyone
const publicPages = [{ path: "/", element: <HomePage /> }];

// Readable without logging in, but without access to the rest of the site
const standalonePages = [
  { path: "/privacy-policy", element: <PrivacyPolicyPage /> },
  { path: "/contact", element: <ContactPage /> },
];

// Everything else requires login
const pages = [
  { path: "/predictors", element: <PredictorsPage /> },
  { path: "/predictors/breast", element: <BreastPage /> },
  { path: "/predictors/lung", element: <LungPage /> },
  { path: "/predictors/heart", element: <HeartPage /> },
  { path: "/predictors/diabetes", element: <DiabetesPage /> },
  { path: "/about", element: <AboutPage /> },
  { path: "/about-predictix", element: <AboutPredictixPage /> },
  { path: "/integration", element: <IntegrationPage /> },
  { path: "/faqs", element: <FAQPage /> },
  { path: "/account", element: <AccountPage /> },
];

// Login, sign up and password pages have no navbar
const authPages = [
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/change-password", element: <ForgotPasswordPage /> },
];

function App() {
  return (
    <I18nProvider>
      <UserContextProvider>
        <Router>
          <ScrollToTop />
          <ScrollBackground />
          <div className="App">
            <Routes>
              {authPages.map(({ path, element }) => (
                <Route
                  key={path}
                  path={path}
                  element={withLayout(element, { navbar: false })}
                />
              ))}
              {publicPages.map(({ path, element }) => (
                <Route key={path} path={path} element={withLayout(element)} />
              ))}
              {standalonePages.map(({ path, element }) => (
                <Route
                  key={path}
                  path={path}
                  element={<PublicPage>{element}</PublicPage>}
                />
              ))}
              {pages.map(({ path, element }) => (
                <Route
                  key={path}
                  path={path}
                  element={<RequireAuth>{withLayout(element)}</RequireAuth>}
                />
              ))}
            </Routes>
          </div>
        </Router>
      </UserContextProvider>
    </I18nProvider>
  );
}

export default App;
