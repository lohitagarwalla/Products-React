import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const { login } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  async function onSubmit(data) {
    setError(null);
    const result = await login(data);
    if (result.success) {
      navigate("/");
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="page">
      <div className="container">
        <div className="auth-container">
          <h1 className="page-title">Login</h1>
          <form className="auth-form" onSubmit={handleSubmit(onSubmit)}>
            {error && <div className="error-message" role="alert">{error}</div>}
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
                autoComplete="current-password"
                {...register("password", {
                  required: "Password is required",
                  minLength: { value: 6, message: "Password must be at least 6 characters" },
                })}
              />
              {errors.password && <span className="form-error">{errors.password.message}</span>}
            </div>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-large">
              {isSubmitting ? "Please wait..." : "Login"}
            </button>
          </form>
          <div className="auth-switch">
            <p>Don't have an account? <Link className="auth-link" to="/signup">Sign Up</Link></p>
            <p>Demo account: lohitagarwalla@gmail.com / password: Lohit123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
