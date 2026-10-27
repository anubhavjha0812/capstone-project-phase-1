import React, { useContext, useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { UserContext } from "../context/UserContext";

// Shows the page only to logged-in users; everyone else is sent to Log In and
// brought back to this page afterwards.
function RequireAuth({ children }) {
  const { userInfo, setUserInfo } = useContext(UserContext);
  const location = useLocation();
  // No saved user in this browser: ask the server once whether the login cookie is still valid
  const [checking, setChecking] = useState(!userInfo?.username);

  useEffect(() => {
    if (userInfo?.username) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    fetch("http://localhost:8080/api/v1/users/profile", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.data) setUserInfo(data.data);
      })
      .catch(() => {})
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
    // Only re-check when the login state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInfo?.username]);

  if (userInfo?.username) return children;
  if (checking) return null;

  return (
    <Navigate
      to="/login"
      replace
      state={{ from: location.pathname + location.search + location.hash }}
    />
  );
}

export default RequireAuth;
