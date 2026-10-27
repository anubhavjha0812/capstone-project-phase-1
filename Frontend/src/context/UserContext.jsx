import { createContext, useState } from "react";

export const UserContext = createContext({});

// Keep only non-sensitive user fields. Older versions stored the whole API
// response (including access/refresh tokens) in localStorage.
const toSafeUser = (data) => {
  const user = data?.data?.user || data?.data || data?.user || data;
  if (!user?.username) return null;
  return {
    _id: user._id,
    username: user.username,
    email: user.email,
    fullname: user.fullname,
  };
};

export function UserContextProvider({ children }) {
  const [userInfo, setUserInfoState] = useState(() => {
    try {
      const saved = localStorage.getItem("userInfo");
      const user = saved ? toSafeUser(JSON.parse(saved)) : null;
      // Rewrite old entries that still contain tokens
      if (user) localStorage.setItem("userInfo", JSON.stringify(user));
      else localStorage.removeItem("userInfo");
      return user;
    } catch (err) {
      console.error("Failed to parse userInfo from localStorage:", err);
      return null;
    }
  });

  const setUserInfo = (data) => {
    const user = data ? toSafeUser(data) : null;
    setUserInfoState(user);
    try {
      if (user) {
        localStorage.setItem("userInfo", JSON.stringify(user));
      } else {
        localStorage.removeItem("userInfo");
      }
    } catch (err) {
      console.error("Failed to save userInfo to localStorage:", err);
    }
  };

  return (
    <UserContext.Provider value={{ userInfo, setUserInfo }}>
      {children}
    </UserContext.Provider>
  );
}
