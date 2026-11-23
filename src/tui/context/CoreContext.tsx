import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { VideoDLCore } from '../../core/app-core.js';
import type { SystemDependencyReport } from '../../types/dependencies.js';
import type { DownloadJob } from '../../types/download.js';
import type { HistoryRecord } from '../../types/history.js';
import type { AppSettings } from '../../types/settings.js';

export type ScreenId =
  | 'home'
  | 'new-download'
  | 'queue'
  | 'history'
  | 'settings'
  | 'system-status';

interface CoreContextValue {
  core: VideoDLCore;
  activeScreen: ScreenId;
  setActiveScreen: (screen: ScreenId) => void;
  jobs: DownloadJob[];
  history: HistoryRecord[];
  settings: AppSettings;
  dependencyReport: SystemDependencyReport | null;
  isInputFocused: boolean;
  setIsInputFocused: (focused: boolean) => void;
  refreshHistory: () => void;
  refreshSettings: () => void;
  refreshDependencies: () => Promise<void>;
  statusBanner: string | null;
  setStatusBanner: (msg: string | null) => void;
}

const CoreContext = createContext<CoreContextValue | null>(null);

export interface CoreProviderProps {
  core: VideoDLCore;
  children: React.ReactNode;
}

export function CoreProvider({ core, children }: CoreProviderProps): React.JSX.Element {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('home');
  const [jobs, setJobs] = useState<DownloadJob[]>(() => core.queue.listJobs());
  const [history, setHistory] = useState<HistoryRecord[]>(() =>
    core.history.listHistory(100),
  );
  const [settings, setSettings] = useState<AppSettings>(() =>
    core.settings.getSettings(),
  );
  const [dependencyReport, setDependencyReport] =
    useState<SystemDependencyReport | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const refreshHistory = useCallback(() => {
    setHistory(core.history.listHistory(100));
  }, [core]);

  const refreshSettings = useCallback(() => {
    setSettings(core.settings.getSettings());
  }, [core]);

  const refreshDependencies = useCallback(async () => {
    const report = await core.dependencies.checkAll();
    setDependencyReport(report);
  }, [core]);

  useEffect(() => {
    void refreshDependencies();

    const onUpdated = (updatedJobs: DownloadJob[]) => {
      setJobs([...updatedJobs]);
    };
    const onFinished = () => {
      setHistory(core.history.listHistory(100));
    };

    core.queue.on('updated', onUpdated);
    core.queue.on('jobCompleted', onFinished);
    core.queue.on('jobFailed', onFinished);

    return () => {
      core.queue.off('updated', onUpdated);
      core.queue.off('jobCompleted', onFinished);
      core.queue.off('jobFailed', onFinished);
    };
  }, [core, refreshDependencies]);

  return (
    <CoreContext.Provider
      value={{
        core,
        activeScreen,
        setActiveScreen,
        jobs,
        history,
        settings,
        dependencyReport,
        isInputFocused,
        setIsInputFocused,
        refreshHistory,
        refreshSettings,
        refreshDependencies,
        statusBanner,
        setStatusBanner,
      }}
    >
      {children}
    </CoreContext.Provider>
  );
}

export function useCore(): CoreContextValue {
  const ctx = useContext(CoreContext);
  if (!ctx) {
    throw new Error('useCore must be used within a CoreProvider');
  }
  return ctx;
}
