'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import { hubPlugins, type HubPlugin } from '@/lib/home-data';

const fmt = new Intl.NumberFormat('en');
const hubUrl = (slug: string) => `https://hub.pelican.dev/plugins/${slug}`;

/**
 * Three plugin cards. Each thumbnail is a screenshot from the plugin's page on the
 * Pelican Hub; the card links to that page and the corner button opens the
 * full-size screenshot in a native <dialog> (Esc or the close button closes it).
 */
export function PluginStage() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState<HubPlugin | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  function show(plugin: HubPlugin, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setOpen(plugin);
  }

  function onClose() {
    setOpen(null);
    triggerRef.current?.focus();
  }

  return (
    <>
      <ul className="pl-plugins__cards">
        {hubPlugins.map((plugin) => (
          <PluginCard key={plugin.slug} plugin={plugin} onZoom={show} />
        ))}
      </ul>
      <dialog
        ref={dialogRef}
        className="pl-pcard__dialog"
        aria-labelledby="pl-pcard-dialog-title"
        onClose={onClose}
        // A click on the dialog element itself is a click on the backdrop.
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      >
        {open && (
          <figure>
            <div className="pl-pcard__dialog-bar">
              <p id="pl-pcard-dialog-title" className="d">
                {open.name}
              </p>
              <button
                type="button"
                className="pl-pcard__dialog-close"
                aria-label="Close screenshot"
                onClick={() => dialogRef.current?.close()}
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={open.shot.original.src}
              width={open.shot.original.width}
              height={open.shot.original.height}
              alt={open.shot.alt}
            />
            <figcaption>
              Screenshot by {open.author}, from the plugin&apos;s page on the Pelican Hub.{' '}
              <a href={hubUrl(open.slug)}>Open {open.name} on the Hub</a>
            </figcaption>
          </figure>
        )}
      </dialog>
    </>
  );
}

function PluginCard({
  plugin,
  onZoom,
}: {
  plugin: HubPlugin;
  onZoom: (plugin: HubPlugin, trigger: HTMLButtonElement) => void;
}) {
  return (
    <li className="pl-pcard">
      <div className="pl-pcard__thumb">
        <div className="pl-pcard__bar" aria-hidden>
          <i />
          <i />
          <i />
          <span>Screenshot</span>
        </div>
        <div className="pl-pcard__frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={plugin.shot.src}
            width={plugin.shot.width}
            height={plugin.shot.height}
            alt={plugin.shot.alt}
            loading="lazy"
            decoding="async"
            style={{ objectPosition: plugin.shot.position }}
          />
        </div>
        <span className={`pl-sticker ${plugin.official ? 'pl-sticker--sky' : ''}`}>
          {plugin.official ? 'Official' : 'Community'}
        </span>
        <button
          type="button"
          className="pl-pcard__zoom"
          aria-haspopup="dialog"
          aria-label={`View the full-size screenshot of ${plugin.name}`}
          onClick={(e) => onZoom(plugin, e.currentTarget)}
        >
          <Maximize2 size={18} aria-hidden />
        </button>
      </div>
      <div className="pl-pcard__body">
        <h3 className="d pl-pcard__name">
          <a href={hubUrl(plugin.slug)}>{plugin.name}</a>
        </h3>
        <p className="pl-pcard__desc">{plugin.desc}</p>
        <p className="pl-pcard__by">
          by {plugin.author} · {fmt.format(plugin.downloads)} downloads
        </p>
      </div>
    </li>
  );
}
