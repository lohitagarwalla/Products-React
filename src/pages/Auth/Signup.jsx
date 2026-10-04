import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Signup() {
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { signUp } = useAuth();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm();

  async function onSubmit(data) {
    setError(null);
    const result = await signUp(data);
    if (result.success) {
      const from = location.state?.from;
      navigate(typeof from === "string" && from.startsWith("/") && !from.startsWith("//") ? from : "/", { replace: true });
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="page">
      <div className="container">
        <div className="auth-container">
          <h1 className="page-title">Sign Up</h1>
          <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
            {error && <div className="error-message" role="alert">{error}</div>}
            <div className="form-group">
              <label className="form-label" htmlFor="firstname">First name</label>
              <input
                className="form-input"
                id="firstname"
                type="text"
                autoComplete="given-name"
                {...register("firstname", {
                  required: "First name is required",
                  setValueAs: value => value.trim(),
                })}
              />
              {errors.firstname && <span className="form-error">{errors.firstname.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="lastname">Last name</label>
              <input
                className="form-input"
                id="lastname"
                type="text"
                autoComplete="family-name"
                {...register("lastname", {
                  required: "Last name is required",
                  setValueAs: value => value.trim(),
                })}
              />
              {errors.lastname && <span className="form-error">{errors.lastname.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                className="form-input"
                id="email"
                type="email"
                autoComplete="email"
                {...register("email", { required: "Email is required" })}
              />
              {errors.email && <span className="form-error">{errors.email.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                className="form-input"
                id="password"
                type="password"
                autoComplete="new-password"
                {...register("password", {
                  required: "Password is required",
                  minLength: { value: 6, message: "Password must be at least 6 characters" },
                  pattern: {
                    value: /[A-Z]/,
                    message: "Password must contain at least one uppercase letter",
                  },
                })}
              />
              {errors.password && <span className="form-error">{errors.password.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirm password</label>
              <input
                className="form-input"
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                {...register("confirmPassword", {
                  required: "Please confirm your password",
                  validate: value => value === getValues("password") || "Passwords do not match",
                })}
              />
              {errors.confirmPassword && <span className="form-error">{errors.confirmPassword.message}</span>}
            </div>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-large">
              {isSubmitting ? "Please wait..." : "Sign Up"}
            </button>
          </form>
          <div className="auth-switch">
            <p>Already have an account? <Link className="auth-link" to="/login" state={location.state}>Login</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
