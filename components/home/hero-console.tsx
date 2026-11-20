'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

type Level = 'INFO' | 'WARN';
type Tone = 'plain' | 'join' | 'chat' | 'done' | 'warn' | 'echo' | 'system';
interface Line {
  id: number;
  time: string;
  level: Level;
  text: string;
  tone: Tone;
}
type Status = 'running' | 'stopping' | 'offline' | 'starting';

const MAX_PLAYERS = 20;

// What a Paper server prints while starting; used for the first render and for Start/Restart.
const BOOT: [Level, string, Tone][] = [
  ['INFO', 'Starting minecraft server version 1.21.4', 'plain'],
  ['INFO', 'Loading properties', 'plain'],
  ['INFO', 'Preparing level "world"', 'plain'],
  ['INFO', 'Preparing spawn area: 100%', 'plain'],
  ['INFO', 'Done (8.912s)! For help, type "help"', 'done'],
];

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

let nextId = 0;
const line = (time: string, level: Level, text: string, tone: Tone = 'plain'): Line => ({
  id: nextId++,
  time,
  level,
  text,
  tone,
});

// Fixed times for the server render, so it matches the first client render exactly.
const FIRST: Line[] = [
  ...BOOT.map(([level, text, tone], i) => line(`12:04:${pad(22 + i * 2)}`, level, text, tone)),
  line('12:06:02', 'INFO', 'Steve joined the game', 'join'),
  line('12:06:45', 'INFO', '<Steve> anyone up for the nether?', 'chat'),
  line('12:07:10', 'INFO', 'Alex joined the game', 'join'),
];

export function HeroConsole() {
  const id = useId();
  const [status, setStatus] = useState<Status>('running');
  const [lines, setLines] = useState<Line[]>(FIRST);
  const [players, setPlayers] = useState(['Steve', 'Alex']);
  const [cpu, setCpu] = useState(23.4);
  const [memory, setMemory] = useState(2.1);
  const [zone, setZone] = useState<string>();
  const [command, setCommand] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const push = (...next: Line[]) => setLines((current) => [...current, ...next].slice(-40));
  const now = () => clock(new Date());
  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));

  // Once in the browser: read the visitor's own clock and let them join.
  useEffect(() => {
    setZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    later(900, () => {
      setPlayers((p) => [...p, 'you']);
      push(line(now(), 'INFO', 'you joined the game', 'join'));
    });
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live-looking resource use while the server runs.
  useEffect(() => {
    if (status !== 'running') {
      setCpu(0);
      return;
    }
    const tick = window.setInterval(() => {
      setCpu((v) => Math.min(96, Math.max(8, v + (Math.random() - 0.5) * 9)));
      setMemory((v) => Math.min(5.6, Math.max(1.8, v + (Math.random() - 0.48) * 0.08)));
    }, 1600);
    return () => window.clearInterval(tick);
  }, [status]);

  // Keep the newest line in view.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  function stop(then?: () => void) {
    if (status !== 'running') return;
    setStatus('stopping');
    push(line(now(), 'INFO', 'Stopping the server', 'system'), line(now(), 'INFO', 'Saving players', 'plain'));
    later(700, () => {
      push(line(now(), 'INFO', 'Saving worlds', 'plain'), line(now(), 'INFO', 'Server stopped.', 'system'));
      setPlayers([]);
      setStatus('offline');
      setMemory(0);
      then?.();
    });
  }

  function start() {
    setStatus('starting');
    BOOT.forEach(([level, text, tone], i) => later(250 + i * 380, () => push(line(now(), level, text, tone))));
    later(250 + BOOT.length * 380, () => {
      setStatus('running');
      setMemory(1.9);
      setCpu(31);
    });
  }

  function run(event: FormEvent) {
    event.preventDefault();
    const input = command.trim();
    if (!input || status !== 'running') return;
    setCommand('');
    const [name, ...rest] = input.replace(/^\//, '').split(/\s+/);
    const arg = rest.join(' ');
    const echo = line(now(), 'INFO', `> ${input}`, 'echo');

    switch (name.toLowerCase()) {
      case 'help':
        push(echo, line(now(), 'INFO', 'Try: list, say <message>, time, stop, help', 'system'));
        break;
      case 'list':
        push(
          echo,
          line(now(), 'INFO', `There are ${players.length} of a max of ${MAX_PLAYERS} players online: ${players.join(', ')}`),
        );
        break;
      case 'say':
        push(echo, line(now(), 'INFO', `[Server] ${arg || '…'}`, 'chat'));
        break;
      case 'time':
        push(echo, line(now(), 'INFO', `It is ${now().slice(0, 5)} where you are${zone ? ` (${zone})` : ''}.`, 'system'));
        break;
      case 'stop':
        push(echo);
        stop();
        break;
      default:
        push(echo, line(now(), 'WARN', `Unknown command "${name}". Type "help" for help.`, 'warn'));
    }
  }

  const running = status === 'running';
  const statusLabel = { running: 'Running', stopping: 'Stopping', offline: 'Offline', starting: 'Starting' }[status];

  return (
    <div className="pl-console" data-ui data-status={status}>
      <div className="pl-console__top">
        <div>
          <p className="pl-console__name">survival-smp</p>
          <p className="pl-console__meta">play.example.net:25565 · Paper 1.21.4</p>
        </div>
        <p className="pl-console__status" role="status">
          <span aria-hidden /> {statusLabel}
        </p>
      </div>

      <div className="pl-console__actions">
        <button type="button" onClick={start} disabled={status !== 'offline'}>
          Start
        </button>
        <button type="button" onClick={() => stop(start)} disabled={!running}>
          Restart
        </button>
        <button type="button" className="is-danger" onClick={() => stop()} disabled={!running}>
          Stop
        </button>
      </div>

      <dl className="pl-console__stats">
        <div>
          <dt>CPU</dt>
          <dd>
            {cpu.toFixed(1)}% <span>/ 400%</span>
          </dd>
          <meter min={0} max={400} value={cpu} aria-label="CPU use" />
        </div>
        <div>
          <dt>Memory</dt>
          <dd>
            {memory.toFixed(1)} GiB <span>/ 6 GiB</span>
          </dd>
          <meter min={0} max={6} value={memory} aria-label="Memory use" />
        </div>
        <div>
          <dt>Players</dt>
          <dd>
            {players.length} <span>/ {MAX_PLAYERS}</span>
          </dd>
          <meter min={0} max={MAX_PLAYERS} value={players.length} aria-label="Players online" />
        </div>
      </dl>

      <div className="pl-console__log" ref={logRef} role="log" aria-live="polite" aria-label="Server console">
        {lines.map((l) => (
          <p key={l.id} data-tone={l.tone}>
            <span className="pl-console__time">[{l.time} </span>
            <span className={l.level === 'WARN' ? 'pl-console__warn' : 'pl-console__info'}>{l.level}</span>
            <span className="pl-console__time">]: </span>
            {l.text}
          </p>
        ))}
      </div>

      <form className="pl-console__input" onSubmit={run}>
        <label htmlFor={`${id}-cmd`} className="sr-only">
          Console command
        </label>
        <span aria-hidden>›</span>
        <input
          id={`${id}-cmd`}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder={running ? 'Type a command, like help or list' : 'The server is offline. Press Start.'}
          disabled={!running}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" disabled={!running || !command.trim()} aria-label="Send command">
          ↵
        </button>
      </form>
    </div>
  );
}
