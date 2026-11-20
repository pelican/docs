/** The parts of an install the docs can fill in for the reader. */
export const SETUP_FIELDS = ['domain', 'webserver', 'ssl', 'php', 'path'] as const;
export type SetupField = (typeof SETUP_FIELDS)[number];

/** Fields that replace text inside code blocks (see lib/shiki-setup.ts). */
export const TEXT_FIELDS = ['domain', 'php', 'path'] as const;
export type TextField = (typeof TEXT_FIELDS)[number];

export function isTextField(value: unknown): value is TextField {
  return TEXT_FIELDS.includes(value as TextField);
}

export const PHP_VERSIONS = ['8.5', '8.4'] as const;
export const DEFAULT_PHP = '8.5';
export const DEFAULT_PATH = '/var/www/pelican';

export const WEBSERVERS = [
  { value: 'nginx', label: 'NGINX' },
  { value: 'apache', label: 'Apache' },
  { value: 'caddy', label: 'Caddy' },
] as const;
