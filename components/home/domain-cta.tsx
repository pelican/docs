'use client';

import { useId, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { setStoredValue, useStoredValue } from '@/components/setup/store';
import { links } from '@/lib/links';

/**
 * "Your domain" strip in the install section. Saves the domain where the
 * docs' <SetupPanel /> reads it and opens the guide, so every command and
 * config file there already shows it. Nothing is sent anywhere.
 */
export function DomainCta() {
  const id = useId();
  const router = useRouter();
  const saved = useStoredValue('setup:domain');
  const [value, setValue] = useState<string>();
  const domain = value ?? saved ?? '';

  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (clean) setStoredValue('setup:domain', clean);
    router.push(links.webserver);
  }

  return (
    <form className="pl-domain" onSubmit={submit}>
      <label htmlFor={`${id}-d`} className="pl-domain__label">
        Where will your panel live?
      </label>
      <input
        id={`${id}-d`}
        className="pl-domain__input"
        value={domain}
        onChange={(e) => setValue(e.target.value)}
        placeholder="panel.example.com"
        inputMode="url"
        autoComplete="url"
        spellCheck={false}
        maxLength={253}
      />
      <button type="submit" className="pl-btn pl-btn--ink">
        Open my config <ArrowRight size={18} aria-hidden />
      </button>
      <p className="pl-domain__note">
        The guide fills your domain into every NGINX, Apache and Caddy file. It stays in this browser.
      </p>
    </form>
  );
}
