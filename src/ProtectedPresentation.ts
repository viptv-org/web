import { createContext, useContext } from 'react';

// Authorization stays on the server. This boundary only hides already-mounted
// same-scope drafts while the parent challenge owns the presentation.
export const ProtectedPresentation = createContext(false);
export const useProtectedPresentation = () => useContext(ProtectedPresentation);
