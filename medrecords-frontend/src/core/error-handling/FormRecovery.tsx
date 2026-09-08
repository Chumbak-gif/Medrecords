/**
 * Form data preservation on error boundary recovery.
 *
 * Preserves unsaved form data when an ErrorBoundary catches an error,
 * and offers a recovery option to restore form state after re-render.
 *
 * Usage:
 *   <FormRecoveryProvider formId="patient-form">
 *     <PatientForm />
 *   </FormRecoveryProvider>
 *
 * Inside the form component, use:
 *   const { saveFormData, getRecoveredData, clearRecoveredData, hasRecoveredData } = useFormRecovery();
 *
 * Requirements: 5.8
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FormRecoveryContextValue {
  /** Save current form data for potential recovery */
  saveFormData: (data: Record<string, unknown>) => void;
  /** Get recovered form data (if any available from a previous error) */
  getRecoveredData: () => Record<string, unknown> | null;
  /** Clear the recovered data after it has been restored */
  clearRecoveredData: () => void;
  /** Whether there is recovered data available */
  hasRecoveredData: boolean;
  /** Show recovery prompt to the user */
  showRecoveryPrompt: boolean;
  /** Accept recovery - restore form data */
  acceptRecovery: () => void;
  /** Dismiss recovery - discard saved data */
  dismissRecovery: () => void;
}

interface FormRecoveryProviderProps {
  /** Unique identifier for the form (used as storage key) */
  formId: string;
  /** Children components */
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// In-memory storage for form data (keyed by formId)
// ---------------------------------------------------------------------------

const formDataStore = new Map<string, Record<string, unknown>>();

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const FormRecoveryContext = createContext<FormRecoveryContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function FormRecoveryProvider({
  formId,
  children,
}: FormRecoveryProviderProps): ReactNode {
  const [hasRecoveredData, setHasRecoveredData] = useState<boolean>(false);
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState<boolean>(false);
  const latestFormDataRef = useRef<Record<string, unknown> | null>(null);

  // On mount, check if we have saved data for this form (from a previous error)
  useEffect(() => {
    const savedData = formDataStore.get(formId);
    if (savedData) {
      setHasRecoveredData(true);
      setShowRecoveryPrompt(true);
    }
  }, [formId]);

  const saveFormData = useCallback(
    (data: Record<string, unknown>) => {
      latestFormDataRef.current = { ...data };
      formDataStore.set(formId, { ...data });
    },
    [formId],
  );

  const getRecoveredData = useCallback((): Record<string, unknown> | null => {
    return formDataStore.get(formId) ?? null;
  }, [formId]);

  const clearRecoveredData = useCallback(() => {
    formDataStore.delete(formId);
    latestFormDataRef.current = null;
    setHasRecoveredData(false);
    setShowRecoveryPrompt(false);
  }, [formId]);

  const acceptRecovery = useCallback(() => {
    setShowRecoveryPrompt(false);
    // Data remains available via getRecoveredData() for the form to restore
  }, []);

  const dismissRecovery = useCallback(() => {
    formDataStore.delete(formId);
    latestFormDataRef.current = null;
    setHasRecoveredData(false);
    setShowRecoveryPrompt(false);
  }, [formId]);

  const value: FormRecoveryContextValue = {
    saveFormData,
    getRecoveredData,
    clearRecoveredData,
    hasRecoveredData,
    showRecoveryPrompt,
    acceptRecovery,
    dismissRecovery,
  };

  return (
    <FormRecoveryContext.Provider value={value}>
      {children}
    </FormRecoveryContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Hook to access form recovery functionality.
 * Must be used within a FormRecoveryProvider.
 */
export function useFormRecovery(): FormRecoveryContextValue {
  const context = useContext(FormRecoveryContext);
  if (!context) {
    throw new Error('useFormRecovery must be used within a FormRecoveryProvider');
  }
  return context;
}

// ---------------------------------------------------------------------------
// Recovery Prompt UI Component
// ---------------------------------------------------------------------------

export interface FormRecoveryPromptProps {
  /** Called when user accepts recovery */
  onRestore: () => void;
  /** Called when user dismisses recovery */
  onDiscard: () => void;
}

/**
 * A simple recovery prompt component that can be rendered when
 * recovered form data is available.
 */
export function FormRecoveryPrompt({
  onRestore,
  onDiscard,
}: FormRecoveryPromptProps): ReactNode {
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        padding: '1rem',
        marginBottom: '1rem',
        border: '1px solid #d69e2e',
        borderRadius: '8px',
        backgroundColor: '#fefcbf',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
      }}
    >
      <div>
        <strong style={{ color: '#744210' }}>Unsaved data recovered</strong>
        <p style={{ color: '#744210', margin: '0.25rem 0 0 0', fontSize: '0.875rem' }}>
          We found form data from before the error. Would you like to restore it?
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
        <button
          onClick={onRestore}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#d69e2e',
            color: '#ffffff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Restore
        </button>
        <button
          onClick={onDiscard}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'transparent',
            color: '#744210',
            border: '1px solid #d69e2e',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utility: save form data before error boundary catches
// ---------------------------------------------------------------------------

/**
 * Utility to preserve form data when an error is about to be caught
 * by an ErrorBoundary. Call this in the onError callback of ErrorBoundary.
 *
 * Usage in ErrorBoundary onError prop:
 *   onError={(error, errorInfo) => {
 *     preserveFormDataOnError('my-form', currentFormValues);
 *   }}
 */
export function preserveFormDataOnError(
  formId: string,
  formData: Record<string, unknown>,
): void {
  if (formData && Object.keys(formData).length > 0) {
    formDataStore.set(formId, { ...formData });
  }
}

/**
 * Get all stored form data entries (for debugging or bulk recovery).
 */
export function getAllPreservedFormData(): Map<string, Record<string, unknown>> {
  return new Map(formDataStore);
}

/**
 * Clear all preserved form data.
 */
export function clearAllPreservedFormData(): void {
  formDataStore.clear();
}
