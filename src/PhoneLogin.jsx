import React, { useState, useRef } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "./firebase";
import { COLORS } from "./constants";

// Family sign-in via phone + OTP. Two steps: send code, verify code.
// Firebase requires an invisible reCAPTCHA to send SMS from the browser —
// it's created once and reused so re-sending a code doesn't need a fresh
// widget each time.
export default function PhoneLogin({ onSignedIn }) {
  const [step, setStep] = useState("phone"); // "phone" | "otp"
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const confirmationRef = useRef(null);
  const recaptchaRef = useRef(null);

  const inputStyle = {
    width: "100%", padding: "12px 14px", borderRadius: 8,
    border: `1.5px solid ${COLORS.ink}`, fontSize: 16, background: "#fff", boxSizing: "border-box",
  };
  const btnStyle = {
    width: "100%", marginTop: 12, background: COLORS.ink, color: "#fff", border: "none",
    borderRadius: 8, padding: "12px", fontSize: 15, fontWeight: 700, cursor: "pointer",
  };

  const ensureRecaptcha = () => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", { size: "invisible" });
    }
    return recaptchaRef.current;
  };

  const sendCode = async (e) => {
    e.preventDefault();
    setError("");
    const trimmed = phone.trim();
    // Expects E.164 format, e.g. +919876543210 — adjust the placeholder/
    // validation here if you want to default-prefix a country code instead
    // of asking people to type "+91" themselves.
    if (!/^\+[1-9]\d{7,14}$/.test(trimmed)) {
      setError("Enter your number with country code, e.g. +919876543210");
      return;
    }
    setSending(true);
    try {
      const verifier = ensureRecaptcha();
      confirmationRef.current = await signInWithPhoneNumber(auth, trimmed, verifier);
      setStep("otp");
    } catch (err) {
      console.error(err);
      setError("Couldn't send the code — check the number and try again.");
    } finally {
      setSending(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    setError("");
    if (!confirmationRef.current) return;
    setSending(true);
    try {
      const result = await confirmationRef.current.confirm(otp.trim());
      onSignedIn(result.user);
    } catch (err) {
      console.error(err);
      setError("That code didn't match. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "60px auto", padding: 24, background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 12 }}>
      <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Sign in</div>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 18 }}>
        {step === "phone" ? "Enter your phone number to get a code." : `Enter the code sent to ${phone.trim()}.`}
      </div>

      {step === "phone" ? (
        <form onSubmit={sendCode}>
          <input
            type="tel"
            style={inputStyle}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+919876543210"
            autoFocus
          />
          {error && <div style={{ color: COLORS.brick, fontSize: 12, marginTop: 8 }}>{error}</div>}
          <button type="submit" style={btnStyle} disabled={sending}>
            {sending ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode}>
          <input
            type="text"
            inputMode="numeric"
            style={{ ...inputStyle, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.15em", textAlign: "center" }}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            maxLength={6}
            autoFocus
          />
          {error && <div style={{ color: COLORS.brick, fontSize: 12, marginTop: 8 }}>{error}</div>}
          <button type="submit" style={btnStyle} disabled={sending}>
            {sending ? "Verifying…" : "Verify & sign in"}
          </button>
          <button
            type="button"
            onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
            style={{ width: "100%", marginTop: 8, background: "transparent", border: "none", color: "#666", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}
          >
            Use a different number
          </button>
        </form>
      )}

      {/* Required mount point for the invisible reCAPTCHA widget */}
      <div id="recaptcha-container"></div>
    </div>
  );
}
