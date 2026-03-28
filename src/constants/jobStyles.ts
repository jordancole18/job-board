export const ARRANGEMENT_STYLES: Record<string, { bg: string; text: string }> = {
  remote: { bg: 'rgba(59,130,246,0.1)', text: '#2563eb' },
  hybrid: { bg: 'rgba(99,102,241,0.1)', text: '#6366f1' },
  'on-site': { bg: 'rgba(56,182,83,0.1)', text: '#2d9a46' },
};

export const JOB_TYPE_STYLES: Record<string, { bg: string; text: string }> = {
  'full-time': { bg: 'rgba(20,184,166,0.1)', text: '#0d9488' },
  'part-time': { bg: 'rgba(249,115,22,0.1)', text: '#ea580c' },
  contract: { bg: 'rgba(168,85,247,0.1)', text: '#9333ea' },
};

export const ARRANGEMENT_OPTIONS = [
  { value: 'on-site', label: 'On-Site' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
];

export const JOB_TYPE_OPTIONS = [
  { value: 'full-time', label: 'Full-Time' },
  { value: 'part-time', label: 'Part-Time' },
  { value: 'contract', label: 'Contract' },
];

const FALLBACK_STYLE = { bg: 'rgba(107,114,128,0.1)', text: '#6b7280' };

export function getArrangementStyle(value: string) {
  return ARRANGEMENT_STYLES[value] || FALLBACK_STYLE;
}

export function getJobTypeStyle(value: string) {
  return JOB_TYPE_STYLES[value] || FALLBACK_STYLE;
}
