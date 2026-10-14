import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import ProfileForm from "../components/ProfileForm";
import ProfileAddresses from "../components/ProfileAddresses";

export default function Profile() {
  const { user, sessionKey } = useAuth();
  // Until profile endpoints exist, use session identity and keep edits on this page only.
  const [profile, setProfile] = useState(() => ({
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email || "",
    phoneNumber: user.phoneNumber || "",
  }));
  const [editing, setEditing] = useState(false);
  const [applied, setApplied] = useState(false);

  function applyProfile(updatedProfile) {
    setProfile(updatedProfile);
    setEditing(false);
    setApplied(true);
  }

  return (
    <main className="page">
      <div className="container profile-container">
        <h1 className="page-title">Profile</h1>
        <section className="panel" aria-label="Profile details">
          <p className="muted">Profile detail changes are temporary and will reset when you leave or reload this page.</p>
          {applied && <p className="success-message" role="status">Changes applied to this page only.</p>}
          {editing ? (
            <ProfileForm
              profile={profile}
              onApply={applyProfile}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <>
              <dl className="profile-details">
                <div><dt>First name</dt><dd>{profile.firstName || "Not provided"}</dd></div>
                <div><dt>Last name</dt><dd>{profile.lastName || "Not provided"}</dd></div>
                <div><dt>Email</dt><dd>{profile.email || "Not provided"}</dd></div>
                <div><dt>Phone number</dt><dd>{profile.phoneNumber || "Not provided"}</dd></div>
              </dl>
              <button type="button" className="btn btn-primary" onClick={() => { setApplied(false); setEditing(true); }}>
                Edit profile
              </button>
            </>
          )}
        </section>
        <ProfileAddresses key={sessionKey} />
      </div>
    </main>
  );
}
