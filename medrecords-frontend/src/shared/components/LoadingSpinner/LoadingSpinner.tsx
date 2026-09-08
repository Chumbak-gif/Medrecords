/**
 * Loading Spinner component used as Suspense fallback for lazy-loaded routes.
 *
 * Requirements: 7.2, 10.2
 */

export function LoadingSpinner() {
  return (
    <div
      className="loading-spinner"
      role="status"
      aria-label="Loading"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e2e8f0',
          borderTopColor: '#3182ce',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <span className="sr-only" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
        Loading...
      </span>
    </div>
  );
}

export default LoadingSpinner;
