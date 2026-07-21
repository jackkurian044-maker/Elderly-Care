import React, { useEffect, useState } from "react";
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  setDoc, serverTimestamp,
} from "firebase/firestore";
import { Plus, Trash2, Copy, Pill, Users, Smartphone, Check } from "lucide-react";
import { db } from "./firebase";
import { COLORS, DAY_NAMES } from "./constants";

const emptyMed = { name: "", dosage: "", times: ["9:00 AM"], daysOfWeek: [] }; // [] daysOfWeek = every day

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default function FamilyDashboard({ user }) {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [medications, setMedications] = useState([]);
  const [logs, setLogs] = useState([]);
  const [medForm, setMedForm] = useState(emptyMed);
  const [editingMedId, setEditingMedId] = useState(null);
  const [deviceCode, setDeviceCode] = useState(null);
  const [familyCode, setFamilyCode] = useState(null);
  const [copiedCode, setCopiedCode] = useState("");

  // Every senior profile this phone number has access to.
  useEffect(() => {
    const q = query(collection(db, "seniorProfiles"), where("members", "array-contains", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProfiles(list);
      setLoading(false);
      setSelectedId((prev) => prev && list.some((p) => p.id === prev) ? prev : (list[0]?.id || null));
    }, () => setLoading(false));
    return unsub;
  }, [user.uid]);

  // Medications + today-and-recent logs for whichever profile is selected.
  useEffect(() => {
    if (!selectedId) { setMedications([]); setLogs([]); return; }
    const unsubMeds = onSnapshot(collection(db, "seniorProfiles", selectedId, "medications"), (snap) => {
      setMedications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubLogs = onSnapshot(collection(db, "seniorProfiles", selectedId, "medicationLogs"), (snap) => {
      setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    setDeviceCode(null);
    setFamilyCode(null);
    return () => { unsubMeds(); unsubLogs(); };
  }, [selectedId]);

  const selectedProfile = profiles.find((p) => p.id === selectedId) || null;

  const createProfile = async (e) => {
    e.preventDefault();
    const name = newProfileName.trim();
    if (!name) return;
    const ref = await addDoc(collection(db, "seniorProfiles"), {
      name,
      createdBy: user.uid,
      members: [user.uid],
      linkedDeviceUids: [],
      createdAt: serverTimestamp(),
    });
    setNewProfileName("");
    setSelectedId(ref.id);
  };

  const generateInvite = async (type) => {
    const code = generateCode();
    await setDoc(doc(db, "inviteCodes", code), {
      profileId: selectedId,
      type,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    });
    if (type === "device") setDeviceCode(code);
    else setFamilyCode(code);
  };

  const copyCode = (code) => {
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(""), 1500);
  };

  const startEditMed = (m) => {
    setEditingMedId(m.id);
    setMedForm({ name: m.name, dosage: m.dosage || "", times: m.times?.length ? m.times : ["9:00 AM"], daysOfWeek: m.daysOfWeek || [] });
  };

  const cancelEditMed = () => {
    setEditingMedId(null);
    setMedForm(emptyMed);
  };

  const saveMed = async (e) => {
    e.preventDefault();
    if (!medForm.name.trim() || !selectedId) return;
    const payload = {
      name: medForm.name.trim(),
      dosage: medForm.dosage.trim(),
      times: medForm.times.filter((t) => t.trim()),
      daysOfWeek: medForm.daysOfWeek, // [] = every day
      active: true,
    };
    if (editingMedId) {
      await updateDoc(doc(db, "seniorProfiles", selectedId, "medications", editingMedId), payload);
    } else {
      await addDoc(collection(db, "seniorProfiles", selectedId, "medications"), { ...payload, createdAt: serverTimestamp() });
    }
    cancelEditMed();
  };

  const removeMed = async (id) => {
    await deleteDoc(doc(db, "seniorProfiles", selectedId, "medications", id));
  };

  const toggleDay = (day) => {
    setMedForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(day) ? f.daysOfWeek.filter((d) => d !== day) : [...f.daysOfWeek, day],
    }));
  };

  const setTime = (idx, value) => {
    setMedForm((f) => ({ ...f, times: f.times.map((t, i) => (i === idx ? value : t)) }));
  };
  const addTimeSlot = () => setMedForm((f) => ({ ...f, times: [...f.times, "9:00 AM"] }));
  const removeTimeSlot = (idx) => setMedForm((f) => ({ ...f, times: f.times.filter((_, i) => i !== idx) }));

  const inputStyle = {
    width: "100%", padding: "9px 10px", borderRadius: 7,
    border: `1.5px solid ${COLORS.ink}`, fontSize: 13, background: "#fff", boxSizing: "border-box",
  };
  const btnPrimary = {
    background: COLORS.primary, color: "#fff", border: "none", borderRadius: 7,
    padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
  };
  const btnOutline = {
    background: "transparent", border: `1.5px solid ${COLORS.ink}`, borderRadius: 7,
    padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
  };

  // Recent adherence: last 7 days of logs, grouped by date.
  const recentLogs = [...logs]
    .filter((l) => l.status === "taken")
    .sort((a, b) => (b.scheduledFor || "").localeCompare(a.scheduledFor || ""))
    .slice(0, 20);

  if (loading) return <div style={{ padding: 40, fontSize: 14, color: "#666" }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 18 }}>Elderly Care</div>

      {/* ── Profile picker / create ── */}
      <div style={{ background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
        {profiles.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {profiles.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                style={{
                  padding: "7px 14px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: `1.5px solid ${COLORS.ink}`,
                  background: selectedId === p.id ? COLORS.ink : "#fff",
                  color: selectedId === p.id ? "#fff" : COLORS.ink,
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={createProfile} style={{ display: "flex", gap: 8 }}>
          <input
            style={inputStyle}
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="Add a senior's name, e.g. Appa"
          />
          <button type="submit" style={btnPrimary}><Plus size={15} /> Add</button>
        </form>
      </div>

      {!selectedProfile ? (
        <div style={{ textAlign: "center", color: "#666", fontSize: 13, padding: 30 }}>
          Add someone above to get started.
        </div>
      ) : (
        <>
          {/* ── Invite codes ── */}
          <div style={{ background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Connect people to {selectedProfile.name}</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 240px" }}>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <Smartphone size={13} /> {selectedProfile.name}'s own phone/tablet
                </div>
                {deviceCode ? (
                  <CodeChip code={deviceCode} onCopy={copyCode} copied={copiedCode === deviceCode} />
                ) : (
                  <button onClick={() => generateInvite("device")} style={btnOutline}>Generate code</button>
                )}
              </div>
              <div style={{ flex: "1 1 240px" }}>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <Users size={13} /> Another family member
                </div>
                {familyCode ? (
                  <CodeChip code={familyCode} onCopy={copyCode} copied={copiedCode === familyCode} />
                ) : (
                  <button onClick={() => generateInvite("family")} style={btnOutline}>Generate code</button>
                )}
              </div>
            </div>
            {selectedProfile.members?.length > 1 && (
              <div style={{ fontSize: 11.5, color: "#999", marginTop: 12 }}>
                {selectedProfile.members.length} family members connected · {selectedProfile.linkedDeviceUids?.length || 0} device(s) linked
              </div>
            )}
          </div>

          {/* ── Medications ── */}
          <div style={{ background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <Pill size={16} /> Medications
            </div>

            {medications.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                {medications.map((m) => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", border: `1.5px solid ${COLORS.cardBorder}`, borderRadius: 8, padding: "8px 12px" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{m.name} <span style={{ fontWeight: 400, color: "#777" }}>{m.dosage}</span></div>
                      <div style={{ fontSize: 11.5, color: "#777" }}>
                        {(m.times || []).join(", ")} · {m.daysOfWeek?.length ? m.daysOfWeek.map((d) => d.slice(0, 3)).join(", ") : "Every day"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => startEditMed(m)} style={{ ...btnOutline, padding: "5px 10px", fontSize: 12 }}>Edit</button>
                      <button onClick={() => removeMed(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.brick, padding: 5 }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={saveMed} style={{ borderTop: medications.length ? `1.5px dashed ${COLORS.cardBorder}` : "none", paddingTop: medications.length ? 14 : 0 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input style={inputStyle} value={medForm.name} onChange={(e) => setMedForm({ ...medForm, name: e.target.value })} placeholder="Medicine name" />
                <input style={inputStyle} value={medForm.dosage} onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })} placeholder="Dosage, e.g. 500mg" />
              </div>

              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Times</div>
                {medForm.times.map((t, i) => (
                  <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input style={inputStyle} value={t} onChange={(e) => setTime(i, e.target.value)} placeholder="9:00 AM" />
                    {medForm.times.length > 1 && (
                      <button type="button" onClick={() => removeTimeSlot(i)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.brick }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addTimeSlot} style={{ ...btnOutline, padding: "5px 10px", fontSize: 11.5 }}>+ Add another time</button>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>Days (leave all unchecked for every day)</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {DAY_NAMES.map((day) => (
                    <button
                      type="button"
                      key={day}
                      onClick={() => toggleDay(day)}
                      style={{
                        padding: "5px 9px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                        border: `1.5px solid ${COLORS.ink}`,
                        background: medForm.daysOfWeek.includes(day) ? COLORS.ink : "#fff",
                        color: medForm.daysOfWeek.includes(day) ? "#fff" : COLORS.ink,
                      }}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" style={btnPrimary}>
                  <Plus size={15} /> {editingMedId ? "Save changes" : "Add medication"}
                </button>
                {editingMedId && (
                  <button type="button" onClick={cancelEditMed} style={btnOutline}>Cancel</button>
                )}
              </div>
            </form>
          </div>

          {/* ── Adherence log ── */}
          <div style={{ background: "#fff", border: `2px solid ${COLORS.ink}`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Recent activity</div>
            {recentLogs.length === 0 ? (
              <div style={{ fontSize: 13, color: "#666" }}>Nothing logged yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {recentLogs.map((l) => {
                  const med = medications.find((m) => m.id === l.medicationId);
                  return (
                    <div key={l.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0", borderBottom: `1px solid ${COLORS.cardBorder}` }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Check size={13} color={COLORS.taken} /> {med?.name || "(deleted medication)"} · {l.time}
                      </span>
                      <span style={{ color: "#999" }}>{l.scheduledFor}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CodeChip({ code, onCopy, copied }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span className="font-mono" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 18, fontWeight: 700, letterSpacing: "0.1em", background: COLORS.bg, padding: "6px 12px", borderRadius: 7, border: `1.5px solid ${COLORS.cardBorder}` }}>
        {code}
      </span>
      <button onClick={() => onCopy(code)} style={{ background: "none", border: "none", cursor: "pointer", color: copied ? COLORS.taken : "#666" }} title="Copy">
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
    </div>
  );
}
