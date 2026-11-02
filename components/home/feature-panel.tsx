'use client';

import { useState, type ReactNode } from 'react';
import {
  Activity,
  Archive,
  Bell,
  CalendarClock,
  Database,
  FileText,
  Folder,
  Network,
  Play,
  Search,
  Settings,
  SquareTerminal,
  Users,
} from 'lucide-react';

const TABS = [
  { id: 'console', label: 'Console', desc: 'Live logs, commands and power controls for every server.' },
  { id: 'files', label: 'Files', desc: 'Edit configs in a real code editor, or open SFTP in one click.' },
  { id: 'backups', label: 'Backups', desc: 'Keep them on the node, or send them to S3 with backup hosts.' },
  { id: 'schedules', label: 'Schedules', desc: 'Restarts, backups and announcements that run on their own.' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const SIDEBAR = [
  { id: 'console', label: 'Console', icon: SquareTerminal },
  { id: 'files', label: 'Files', icon: Folder },
  { id: 'databases', label: 'Databases', icon: Database },
  { id: 'schedules', label: 'Schedules', icon: CalendarClock },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'backups', label: 'Backups', icon: Archive },
  { id: 'network', label: 'Network', icon: Network },
  { id: 'startup', label: 'Startup', icon: Play },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'activity', label: 'Activity', icon: Activity },
];

/** Feature tabs on the left drive a drawing of the panel on the right. */
export function FeaturePanel() {
  const [tab, setTab] = useState<Tab>('console');

  return (
    <div className="pl-features__grid">
      <div className="pl-features__tabs" role="tablist" aria-label="Panel features">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            aria-controls="pl-panel-view"
            className="pl-ftab"
            onClick={() => setTab(t.id)}
          >
            <span className="pl-ftab__label">{t.label}</span>
            <span className="pl-ftab__desc">{t.desc}</span>
          </button>
        ))}
      </div>

      <div className="pl-panel" data-ui id="pl-panel-view" role="tabpanel" aria-label={`Drawing of the ${tab} page`}>
        <div className="pl-panel__top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/logo.png" alt="" width={24} height={24} />
          <span className="pl-panel__brand">Pelican</span>
          <span className="pl-panel__crumb">/ Servers / Minecraft SMP</span>
          <span className="pl-panel__search">
            <Search size={14} aria-hidden /> Search <kbd>⌘K</kbd>
          </span>
          <Bell size={16} aria-hidden />
          <span className="pl-panel__avatar">S</span>
        </div>
        <div className="pl-panel__body">
          <ul className="pl-panel__side">
            {SIDEBAR.map(({ id, label, icon: Icon }) => (
              <li key={id} className={id === tab ? 'is-on' : undefined}>
                <Icon size={15} aria-hidden /> {label}
              </li>
            ))}
          </ul>
          <div className="pl-panel__main" key={tab}>
            {tab === 'console' && <ConsoleView />}
            {tab === 'files' && <FilesView />}
            {tab === 'backups' && <BackupsView />}
            {tab === 'schedules' && <SchedulesView />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Head({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="pl-panel__head">
      <div>
        <p className="pl-panel__title">
          {title} <span className="pl-panel__running">Running</span>
        </p>
        <p className="pl-panel__sub">play.example.net:25565 · Paper 1.21.4</p>
      </div>
      <div className="pl-panel__btns">{children}</div>
    </div>
  );
}

function ConsoleView() {
  const stats = [
    ['CPU', '23.4%', '/ 400%', 6],
    ['Memory', '2.1 GiB', '/ 6 GiB', 35],
    ['Disk', '4.8 GiB', '/ 20 GiB', 24],
    ['Uptime', '3d 4h', '', 100],
  ] as const;
  return (
    <>
      <Head title="Minecraft SMP">
        <span>Start</span>
        <span className="is-light">Restart</span>
        <span className="is-red">Stop</span>
      </Head>
      <div className="pl-panel__stats">
        {stats.map(([k, v, of, pct]) => (
          <div key={k}>
            <p>{k}</p>
            <p>
              <strong>{v}</strong> {of}
            </p>
            <span style={{ width: `${pct}%` }} data-full={pct === 100 || undefined} />
          </div>
        ))}
      </div>
      <div className="pl-panel__log">
        <p>[12:04:31 INFO]: Done (8.912s)! For help, type &quot;help&quot;</p>
        <p className="y">[12:06:02 INFO]: Steve joined the game</p>
        <p>[12:06:45 INFO]: &lt;Steve&gt; anyone up for the nether?</p>
        <p className="y">[12:07:10 INFO]: Alex joined the game</p>
        <p>[12:08:13 INFO]: &lt;Alex&gt; on my way, bring torches</p>
        <p className="o">[12:09:58 WARN]: Can&apos;t keep up! Is the server overloaded?</p>
      </div>
    </>
  );
}

function FilesView() {
  const rows = [
    ['plugins/', '', 'dir'],
    ['world/', '', 'dir'],
    ['logs/', '', 'dir'],
    ['server.properties', '1.4 KB', 'file'],
    ['paper.jar', '48.2 MB', 'file'],
    ['bukkit.yml', '3.1 KB', 'file'],
    ['eula.txt', '0.2 KB', 'file'],
  ];
  return (
    <>
      <Head title="Files">
        <span className="is-light">Open SFTP</span>
        <span className="is-blue">New file</span>
      </Head>
      <p className="pl-panel__path">/home/container</p>
      <ul className="pl-panel__rows">
        {rows.map(([name, size, kind]) => (
          <li key={name} className={name === 'server.properties' ? 'is-hover' : undefined}>
            {kind === 'dir' ? <Folder size={15} aria-hidden /> : <FileText size={15} aria-hidden />}
            <span>{name}</span>
            <span>{size}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function BackupsView() {
  const rows = [
    ['Nightly', '2 Nov, 03:00', '1.8 GB', 'S3 backup host'],
    ['Before 1.21.4 update', '30 Oct, 19:12', '1.7 GB', 'This node'],
    ['Nightly', '1 Nov, 03:00', '1.8 GB', 'S3 backup host'],
    ['Nightly', '31 Oct, 03:00', '1.7 GB', 'S3 backup host'],
  ];
  return (
    <>
      <Head title="Backups">
        <span className="is-blue">Create backup</span>
      </Head>
      <p className="pl-panel__path">4 of 10 backups used</p>
      <ul className="pl-panel__rows pl-panel__rows--wide">
        {rows.map(([name, when, size, where], i) => (
          <li key={i}>
            <Archive size={15} aria-hidden />
            <span>
              {name}
              <em>{when}</em>
            </span>
            <span>{size}</span>
            <span className="pl-panel__tag">{where}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function SchedulesView() {
  const rows = [
    ['Nightly backup', 'Every day at 03:00', 'in 5h 50m'],
    ['Warn players', 'Every day at 03:55', 'in 6h 45m'],
    ['Restart', 'Every day at 04:00', 'in 6h 50m'],
    ['Clear old logs', 'Sundays at 05:00', 'in 4 days'],
  ];
  return (
    <>
      <Head title="Schedules">
        <span className="is-blue">New schedule</span>
      </Head>
      <p className="pl-panel__path">Times in the server&apos;s time zone</p>
      <ul className="pl-panel__rows pl-panel__rows--wide">
        {rows.map(([name, cron, next]) => (
          <li key={name}>
            <CalendarClock size={15} aria-hidden />
            <span>
              {name}
              <em>{cron}</em>
            </span>
            <span>Next run {next}</span>
            <span className="pl-panel__tag is-on">Active</span>
          </li>
        ))}
      </ul>
    </>
  );
}
