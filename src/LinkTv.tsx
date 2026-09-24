import { useState, type FormEvent } from 'react';
import '@fontsource/onest/latin-400.css';
import '@fontsource/onest/latin-600.css';
import '@fontsource/onest/latin-700.css';
import './LinkTv.css';

/** Public code entry before the existing sign-in and device confirmation flow. */
export function LinkTv({ onCode }: { onCode: (code: string) => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[A-Z0-9]{6,12}$/.test(code)) {
      setError('Enter the 6–12 character code shown on your TV.');
      return;
    }
    onCode(code);
  }

  return (
    <main className="link-tv">
      <form className="link-tv__card" onSubmit={submit} aria-labelledby="link-tv-title">
        <span className="link-tv__mark" aria-hidden="true">V</span>
        <h1 id="link-tv-title">Link your TV</h1>
        <p className="link-tv__intro">Enter the code shown on your TV.</p>
        <label className="link-tv__field" htmlFor="link-tv-code">
          <span>Code</span>
          <input
            id="link-tv-code"
            autoFocus
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={12}
            value={code}
            onChange={event => {
              setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
              setError('');
            }}
            placeholder="AB12CD34"
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
