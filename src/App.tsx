import { useEffect, useState } from 'react';
import { Icon, type IconName } from './components/ui';
import { SettingsModal } from './components/SettingsModal';
import { Overview } from './pages/Overview';
import { Chapters } from './pages/Chapters';
import { Citations } from './pages/Citations';
import { Meetings } from './pages/Meetings';
import { Publications } from './pages/Publications';
import { Timeline } from './pages/Timeline';
import { Reports } from './pages/Reports';

const ROUTES: { path: string; label: string; icon: IconName; el: () => JSX.Element }[] = [
  { path: 'overview', label: 'Home', icon: 'home', el: Overview },
  { path: 'chapters', label: 'Chapters', icon: 'book', el: Chapters },
  { path: 'timeline', label: 'Timeline', icon: 'gantt', el: Timeline },
  { path: 'citations', label: 'Citations', icon: 'quote', el: Citations },
  { path: 'meetings', label: 'Meetings', icon: 'users', el: Meetings },
  { path: 'publications', label: 'Publications', icon: 'send', el: Publications },
  { path: 'reports', label: 'Reports', icon: 'report', el: Reports },
];

function currentPath() {
  const p = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return ROUTES.some((r) => r.path === p) ? p : 'overview';
}

type Theme = 'light' | 'dark' | 'system';

function readTheme(): Theme {
  try {
    return (localStorage.getItem('dissertateai:theme') as Theme) || 'system';
  } catch {
    return 'system';
  }
}

export function App() {
  const [path, setPath] = useState(currentPath);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    const on = () => {
      setPath(currentPath());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('dissertateai:theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const route = ROUTES.find((r) => r.path === path)!;
  const Page = route.el;
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    document.title = `${route.label} · DissertateAI`;
  }, [route]);

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <Icon name="book" size={15} />
          </div>
          <span>DissertateAI</span>
        </div>
        {ROUTES.map((r) => (
          <a key={r.path} href={`#/${r.path}`} className="nav-link" aria-current={r.path === path ? 'page' : undefined} title={r.label}>
            <Icon name={r.icon} />
            <span>{r.label}</span>
          </a>
        ))}
        <div className="sidebar-foot">
          <button className="nav-link btn-ghost" style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={() => setTheme(isDark ? 'light' : 'dark')} title="Toggle light/dark">
            <Icon name={isDark ? 'sun' : 'moon'} />
            <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button className="nav-link" style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={() => setSettings(true)} title="Settings & data">
            <Icon name="settings" />
            <span>Settings</span>
          </button>
        </div>
      </nav>
      <main className="main">
        <div className="page">
          <Page />
        </div>
      </main>
      {settings && <SettingsModal onClose={() => setSettings(false)} />}
    </div>
  );
}
