import { useState } from 'react';
import { api } from '../api.js';

// One form used for both screens: mode is "login" or "signup".
export default function AuthForm({ mode, onAuthenticated, onSwitch }) {
  const isSignup = mode === 'signup';
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const change = (e) => setValues({ ...values, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    setFieldErrors({});
    try {
      const body = isSignup ? values : { email: values.email, password: values.password };
      const { user } = await api(`/auth/${mode}`, { method: 'POST', body });
      onAuthenticated(user);
    } catch (err) {
      setFieldErrors(err.fields);
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const passwordField = (
    <label>
      Password
      <span className="password-wrap">
        <input
          name="password"
          type={showPassword ? 'text' : 'password'}
          value={values.password}
          onChange={change}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={[fieldErrors.password && 'password-error', isSignup && 'password-hint'].filter(Boolean).join(' ') || undefined}
        />
        <button
          type="button"
          className="eye"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showPassword}
          title={showPassword ? 'Hide password' : 'Show password'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
            {showPassword && <line x1="3" y1="3" x2="21" y2="21" />}
          </svg>
        </button>
      </span>
      {fieldErrors.password && <span className="field-error" id="password-error">{fieldErrors.password}</span>}
    </label>
  );

  const field = (name, label, type, autoComplete) => (
    <label>
      {label}
      <input
        name={name}
        type={type}
        value={values[name]}
        onChange={change}
        autoComplete={autoComplete}
        aria-invalid={Boolean(fieldErrors[name])}
        aria-describedby={fieldErrors[name] ? `${name}-error` : undefined}
      />
      {fieldErrors[name] && <span className="field-error" id={`${name}-error`}>{fieldErrors[name]}</span>}
    </label>
  );

  return (
    <form className="card auth-card" onSubmit={submit} noValidate aria-busy={busy}>
      <div>
        <h2>{isSignup ? 'Create your account' : 'Welcome back'}</h2>
        <p className="subtitle">
          {isSignup ? 'Start tracking your glucose readings.' : 'Log in to view your glucose readings.'}
        </p>
      </div>
      {isSignup && field('name', 'Name', 'text', 'name')}
      {field('email', 'Email', 'email', 'email')}
      <div className="field-group">
        {passwordField}
        {isSignup && <small id="password-hint">At least 8 characters.</small>}
      </div>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <button type="submit" className="submit" disabled={busy}>
        {busy && <span className="spinner" aria-hidden="true" />}
        {busy ? (isSignup ? 'Creating account...' : 'Logging in...') : isSignup ? 'Sign up' : 'Log in'}
      </button>
      <p className="switch">
        {isSignup ? 'Already have an account?' : 'New to Sweety?'}{' '}
        <button type="button" className="link" onClick={onSwitch}>
          {isSignup ? 'Log in' : 'Sign up'}
        </button>
      </p>
    </form>
  );
}
