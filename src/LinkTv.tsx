import { useState, type FormEvent } from 'react';
import '@fontsource/onest/latin-400.css';
import '@fontsource/onest/latin-600.css';
import '@fontsource/onest/latin-700.css';
import './LinkTv.css';
import { readDeviceCode } from './lib/deviceCode';

/** Public code entry before the existing sign-in and device confirmation flow. */
export function LinkTv({ onCode }: { onCode: (code: string) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const valid = readDeviceCode(code);
    if (!valid) {
      setError('Enter 8 digits, or a 10-character code using 0–9 and A–F.');
      return;
    }
    onCode(valid);
  }

  return (
    <main className="link-tv">
      <form className="link-tv__card" onSubmit={submit} aria-labelledby="link-tv-title">
        <span className="link-tv__mark" aria-hidden="true">V</span>
        <h1 id="link-tv-title">Link your TV</h1>
        <p className="link-tv__intro">Enter the 8-digit code shown on your TV. Older codes use 10 characters (0–9 and A–F).</p>
        <label className="link-tv__field" htmlFor="link-tv-code">
          <span>Code</span>
          <input
            id="link-tv-code"
            autoFocus
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={10}
            value={code}
            onChange={event => {
              setCode(event.target.value.toUpperCase());
              setError('');
            }}
            placeholder="00123456"
            aria-invalid={!!error}
            aria-describedby={error ? 'link-tv-error' : undefined}
          />
        </label>
        {error && <p className="link-tv__error" id="link-tv-error" role="alert">{error}</p>}
        <button type="submit" className="link-tv__submit">Link TV</button>
      </form>
    </main>
  );
}
