import { useForm } from "react-hook-form";

export default function ProfileForm({ profile, onApply, onCancel }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      phoneNumber: profile.phoneNumber,
    },
  });

  function applyChanges(values) {
    onApply({ ...profile, ...values });
  }

  return (
    <form onSubmit={handleSubmit(applyChanges)} noValidate aria-labelledby="profile-edit-title">
      <h2 id="profile-edit-title">Edit profile</h2>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label" htmlFor="profile-first-name">First name</label>
          <input
            id="profile-first-name"
            className="form-input"
            autoComplete="given-name"
            autoFocus
            aria-invalid={!!errors.firstName}
            aria-describedby={errors.firstName ? "profile-first-name-error" : undefined}
            {...register("firstName", {
              required: "First name is required.",
              maxLength: { value: 100, message: "Use 100 characters or fewer." },
              setValueAs: value => value.trim(),
            })}
          />
          {errors.firstName && <span id="profile-first-name-error" className="form-error" role="alert">{errors.firstName.message}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-last-name">Last name</label>
          <input
            id="profile-last-name"
            className="form-input"
            autoComplete="family-name"
            aria-invalid={!!errors.lastName}
            aria-describedby={errors.lastName ? "profile-last-name-error" : undefined}
            {...register("lastName", {
              required: "Last name is required.",
              maxLength: { value: 100, message: "Use 100 characters or fewer." },
              setValueAs: value => value.trim(),
            })}
          />
          {errors.lastName && <span id="profile-last-name-error" className="form-error" role="alert">{errors.lastName.message}</span>}
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-email">Email</label>
          <input id="profile-email" className="form-input" type="email" value={profile.email} readOnly aria-describedby="profile-email-hint" />
          <p id="profile-email-hint" className="muted">Email cannot be changed here.</p>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-phone">Phone number (optional)</label>
          <input
            id="profile-phone"
            className="form-input"
            type="tel"
            autoComplete="tel"
            aria-invalid={!!errors.phoneNumber}
            aria-describedby={errors.phoneNumber ? "profile-phone-hint profile-phone-error" : "profile-phone-hint"}
            {...register("phoneNumber", {
              setValueAs: value => value.trim(),
              validate: value => !value || (
                /^\+?[\d\s().-]+$/.test(value)
                && value.replace(/\D/g, "").length >= 7
                && value.replace(/\D/g, "").length <= 15
              ) || "Enter a phone number with 7 to 15 digits and an optional country code.",
            })}
          />
          <p id="profile-phone-hint" className="muted">You can include a country code, such as +91.</p>
          {errors.phoneNumber && <span id="profile-phone-error" className="form-error" role="alert">{errors.phoneNumber.message}</span>}
        </div>
      </div>
      <div className="toolbar">
        <button type="submit" className="btn btn-primary">Apply locally</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
