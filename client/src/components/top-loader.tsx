import { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type TopLoaderContextType = {
  isLoading: boolean;
  start: () => void;
  done: () => void;
};

const TopLoaderContext = createContext<TopLoaderContextType>({
  isLoading: false,
  start: () => {},
  done: () => {},
});

export function useTopLoader() {
  return useContext(TopLoaderContext);
}

export function TopLoaderProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);

  const start = useCallback(() => setIsLoading(true), []);
  const done = useCallback(() => setIsLoading(false), []);

  return (
    <TopLoaderContext.Provider value={{ isLoading, start, done }}>
      <AnimatePresence>
        {isLoading && (
          <motion.div
            className="fixed top-0 left-0 right-0 z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div
              className="h-[3px] bg-primary origin-left"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: [0, 0.4, 0.7, 0.85] }}
              transition={{ duration: 3, ease: "easeOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </TopLoaderContext.Provider>
  );
}
