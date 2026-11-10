import { useState } from 'react';
import { api } from '../api.js';

// One form used for both screens: mode is "login" or "signup".
export default function AuthForm({ mode, onAuthenticated, onSwitch }) {
  const isSignup = mode === 'signup';
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

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
      />
      {fieldErrors[name] && <span className="field-error">{fieldErrors[name]}</span>}
    </label>
  );

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>{isSignup ? 'Create your account' : 'Welcome back'}</h2>
      {isSignup && field('name', 'Name', 'text', 'name')}
      {field('email', 'Email', 'email', 'email')}
      {field('password', 'Password', 'password', isSignup ? 'new-password' : 'current-password')}
      {isSignup && <small>At least 8 characters.</small>}
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <button type="submit" disabled={busy}>
        {busy ? 'Please wait...' : isSignup ? 'Sign up' : 'Log in'}
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
