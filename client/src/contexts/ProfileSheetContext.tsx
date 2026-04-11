import { createContext, useContext, useState } from 'react';

interface ProfileSheetContextType {
  isOpen: boolean;
  openProfile: () => void;
  closeProfile: () => void;
}

const ProfileSheetContext = createContext<ProfileSheetContextType | undefined>(undefined);

export function ProfileSheetProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <ProfileSheetContext.Provider
      value={{
        isOpen,
        openProfile: () => setIsOpen(true),
        closeProfile: () => setIsOpen(false),
      }}
    >
      {children}
    </ProfileSheetContext.Provider>
  );
}

export function useProfileSheet() {
  const ctx = useContext(ProfileSheetContext);
  if (!ctx) throw new Error('useProfileSheet must be used within ProfileSheetProvider');
  return ctx;
}
