'use client';

import { useId, type ReactNode } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { setStoredValue, useStoredValue } from './store';
import { DEFAULT_PATH, DEFAULT_PHP, PHP_VERSIONS, WEBSERVERS, type SetupField } from './fields';

/**
 * "Your setup" box. The reader fills it in once; code blocks marked `setup`
 * show their values, and tabs for the web server and HTTPS switch to match.
 *
 *   <SetupPanel fields={['domain', 'webserver', 'ssl', 'php', 'path']} />
 */
export function SetupPanel({ fields = ['domain', 'webserver', 'ssl', 'php', 'path'] }: { fields?: SetupField[] }) {
  const id = useId();
  const domain = useStoredValue('setup:domain') ?? '';
  const php = useStoredValue('setup:php') ?? DEFAULT_PHP;
  const path = useStoredValue('setup:path') ?? '';
  const webserver = useStoredValue('tabs:webserver') ?? 'nginx';
  const ssl = useStoredValue('tabs:ssl') ?? 'https';

  const show = (field: SetupField) => fields.includes(field);

  function reset() {
    for (const key of ['setup:domain', 'setup:php', 'setup:path', 'tabs:webserver', 'tabs:ssl']) {
      setStoredValue(key, null);
    }
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      // The Hub's card: the dt-setup* rules in app/global.css.
      className="dt-setup not-prose my-6"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id={`${id}-title`} className="dt-setup__title flex items-center gap-2">
            <SlidersHorizontal className="size-5" aria-hidden />
            Your setup
          </h2>
          <p className="dt-setup__lede">
            Fill this in and the commands and config files on this page use your values. It&apos;s
            saved in this browser only.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="dt-setup__reset inline-flex shrink-0 items-center gap-1.5"
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Reset
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {show('domain') && (
          <Field label="Domain" htmlFor={`${id}-domain`} hint="The address the panel is served on.">
            <input
              id={`${id}-domain`}
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              maxLength={253}
              placeholder="panel.example.com"
              value={domain}
              onChange={(event) => setStoredValue('setup:domain', event.target.value.trim())}
              className={inputClass}
            />
          </Field>
        )}

        {show('path') && (
          <Field label="Install folder" htmlFor={`${id}-path`} hint={`Leave empty for ${DEFAULT_PATH}.`}>
            <input
              id={`${id}-path`}
              type="text"
              autoComplete="off"
              spellCheck={false}
              maxLength={200}
              placeholder={DEFAULT_PATH}
              value={path}
              onChange={(event) => setStoredValue('setup:path', event.target.value.trim().replace(/\/+$/, ''))}
              className={inputClass}
            />
          </Field>
        )}

        {show('webserver') && (
          <Field label="Web server">
            <Segmented
              name={`${id}-webserver`}
              value={webserver}
              options={WEBSERVERS}
              onChange={(value) => setStoredValue('tabs:webserver', value)}
            />
          </Field>
        )}

        {show('ssl') && (
          <Field label="HTTPS">
            <Segmented
              name={`${id}-ssl`}
              value={ssl}
              options={[
                { value: 'https', label: 'HTTPS (SSL)' },
                { value: 'http', label: 'HTTP only' },
              ]}
              onChange={(value) => setStoredValue('tabs:ssl', value)}
            />
          </Field>
        )}

        {show('php') && (
          <Field label="PHP version">
            <Segmented
              name={`${id}-php`}
              value={php}
              options={PHP_VERSIONS.map((version) => ({ value: version, label: `PHP ${version}` }))}
              onChange={(value) => setStoredValue('setup:php', value === DEFAULT_PHP ? null : value)}
            />
          </Field>
        )}
      </div>
    </section>
  );
}

const inputClass = 'dt-setup__input w-full';

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  const Label = htmlFor ? 'label' : 'span';
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor} className="dt-setup__label">
        {label}
      </Label>
      {children}
      {hint && <p className="dt-setup__hint">{hint}</p>}
    </div>
  );
}

function Segmented({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" className="dt-seg inline-flex w-full">
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label
            key={option.value}
            className="dt-seg__option flex-1 cursor-pointer text-center"
            data-checked={checked || undefined}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
