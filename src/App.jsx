import React, { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import PhoneLogin from "./PhoneLogin";
import FamilyDashboard from "./FamilyDashboard";
import { COLORS } from "./constants";

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setCheckingAuth(false);
    });
    return unsub;
  }, []);

  if (checkingAuth) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.inkSoft, fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg }}>
      {user ? <FamilyDashboard user={user} /> : <PhoneLogin onSignedIn={setUser} />}
    </div>
  );
}
