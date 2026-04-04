"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { setTestingModeEnabled } from "@/utils/testingMode";
import { clearAllCache } from "@/utils/cacheUtils";

interface TestingModeContextType {
  isTestingMode: boolean;
  toggleTestingMode: () => void;
}

const TestingModeContext = createContext<TestingModeContextType>({
  isTestingMode: false,
  toggleTestingMode: () => {},
});

export function TestingModeProvider({ children }: { children: ReactNode }) {
  const [isTestingMode, setIsTestingMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("testingMode");
    if (saved === "true") {
      setIsTestingMode(true);
      setTestingModeEnabled(true);
    }
  }, []);

  const toggleTestingMode = useCallback(() => {
    setIsTestingMode((prev) => {
      const newValue = !prev;
      localStorage.setItem("testingMode", String(newValue));
      setTestingModeEnabled(newValue);
      clearAllCache();
      return newValue;
    });
  }, []);

  return (
    <TestingModeContext.Provider value={{ isTestingMode, toggleTestingMode }}>
      {isTestingMode && (
        <div className="fixed bottom-4 right-4 z-50 px-3 py-1.5 bg-amber-500 text-white text-[10px] font-bold tracking-wider rounded-full shadow-lg opacity-80 pointer-events-none select-none">
          TESTING
        </div>
      )}
      {children}
    </TestingModeContext.Provider>
  );
}

export function useTestingMode() {
  return useContext(TestingModeContext);
}
