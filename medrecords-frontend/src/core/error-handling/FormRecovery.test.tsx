/**
 * Tests for form data preservation on error boundary recovery.
 *
 * Requirements: 5.8
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  FormRecoveryProvider,
  useFormRecovery,
  FormRecoveryPrompt,
  preserveFormDataOnError,
  clearAllPreservedFormData,
} from './FormRecovery';

// Test component that uses the useFormRecovery hook
function TestFormComponent({ onData }: { onData?: (data: Record<string, unknown> | null) => void }) {
  const { saveFormData, getRecoveredData, clearRecoveredData, hasRecoveredData, showRecoveryPrompt, acceptRecovery, dismissRecovery } = useFormRecovery();

  return (
    <div>
      <span data-testid="has-recovered">{String(hasRecoveredData)}</span>
      <span data-testid="show-prompt">{String(showRecoveryPrompt)}</span>
      <button onClick={() => saveFormData({ name: 'John', email: 'john@example.com' })}>
        Save Data
      </button>
      <button onClick={() => {
        const data = getRecoveredData();
        onData?.(data);
      }}>
        Get Data
      </button>
      <button onClick={clearRecoveredData}>Clear</button>
      <button onClick={acceptRecovery}>Accept</button>
      <button onClick={dismissRecovery}>Dismiss</button>
    </div>
  );
}

describe('FormRecovery', () => {
  beforeEach(() => {
    clearAllPreservedFormData();
  });

  describe('FormRecoveryProvider', () => {
    it('provides recovery context to children', () => {
      render(
        <FormRecoveryProvider formId="test-form">
          <TestFormComponent />
        </FormRecoveryProvider>,
      );

      expect(screen.getByTestId('has-recovered').textContent).toBe('false');
    });

    it('detects previously preserved form data on mount', () => {
      // Preserve data before rendering
      preserveFormDataOnError('test-form', { name: 'Jane' });

      render(
        <FormRecoveryProvider formId="test-form">
          <TestFormComponent />
        </FormRecoveryProvider>,
      );

      expect(screen.getByTestId('has-recovered').textContent).toBe('true');
      expect(screen.getByTestId('show-prompt').textContent).toBe('true');
    });

    it('allows saving and recovering form data', () => {
      const onData = vi.fn();

      render(
        <FormRecoveryProvider formId="save-test">
          <TestFormComponent onData={onData} />
        </FormRecoveryProvider>,
      );

      // Save data
      fireEvent.click(screen.getByText('Save Data'));

      // Get data back
      fireEvent.click(screen.getByText('Get Data'));

      expect(onData).toHaveBeenCalledWith({
        name: 'John',
        email: 'john@example.com',
      });
    });

    it('clears recovered data when clearRecoveredData is called', () => {
      preserveFormDataOnError('clear-test', { name: 'Data to clear' });
      const onData = vi.fn();

      render(
        <FormRecoveryProvider formId="clear-test">
          <TestFormComponent onData={onData} />
        </FormRecoveryProvider>,
      );

      // Clear the data
      fireEvent.click(screen.getByText('Clear'));

      // Verify cleared
      fireEvent.click(screen.getByText('Get Data'));
      expect(onData).toHaveBeenCalledWith(null);
      expect(screen.getByTestId('has-recovered').textContent).toBe('false');
    });

    it('dismisses recovery and clears data', () => {
      preserveFormDataOnError('dismiss-test', { name: 'Will be dismissed' });
      const onData = vi.fn();

      render(
        <FormRecoveryProvider formId="dismiss-test">
          <TestFormComponent onData={onData} />
        </FormRecoveryProvider>,
      );

      // Dismiss recovery
      fireEvent.click(screen.getByText('Dismiss'));

      expect(screen.getByTestId('has-recovered').textContent).toBe('false');
      expect(screen.getByTestId('show-prompt').textContent).toBe('false');

      fireEvent.click(screen.getByText('Get Data'));
      expect(onData).toHaveBeenCalledWith(null);
    });
  });

  describe('useFormRecovery', () => {
    it('throws when used outside provider', () => {
      // Suppress console.error from React error boundary
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestFormComponent />);
      }).toThrow('useFormRecovery must be used within a FormRecoveryProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('FormRecoveryPrompt', () => {
    it('renders restore and discard buttons', () => {
      const onRestore = vi.fn();
      const onDiscard = vi.fn();

      render(
        <FormRecoveryPrompt onRestore={onRestore} onDiscard={onDiscard} />,
      );

      expect(screen.getByText('Restore')).toBeDefined();
      expect(screen.getByText('Discard')).toBeDefined();
    });

    it('calls onRestore when restore button is clicked', () => {
      const onRestore = vi.fn();
      const onDiscard = vi.fn();

      render(
        <FormRecoveryPrompt onRestore={onRestore} onDiscard={onDiscard} />,
      );

      fireEvent.click(screen.getByText('Restore'));
      expect(onRestore).toHaveBeenCalledTimes(1);
    });

    it('calls onDiscard when discard button is clicked', () => {
      const onRestore = vi.fn();
      const onDiscard = vi.fn();

      render(
        <FormRecoveryPrompt onRestore={onRestore} onDiscard={onDiscard} />,
      );

      fireEvent.click(screen.getByText('Discard'));
      expect(onDiscard).toHaveBeenCalledTimes(1);
    });

    it('has accessible alert role', () => {
      render(
        <FormRecoveryPrompt onRestore={vi.fn()} onDiscard={vi.fn()} />,
      );

      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  describe('preserveFormDataOnError', () => {
    it('stores form data for recovery', () => {
      preserveFormDataOnError('preserved-form', {
        firstName: 'John',
        lastName: 'Doe',
      });

      const onData = vi.fn();

      render(
        <FormRecoveryProvider formId="preserved-form">
          <TestFormComponent onData={onData} />
        </FormRecoveryProvider>,
      );

      fireEvent.click(screen.getByText('Get Data'));
      expect(onData).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
      });
    });

    it('does not store empty objects', () => {
      preserveFormDataOnError('empty-form', {});

      render(
        <FormRecoveryProvider formId="empty-form">
          <TestFormComponent />
        </FormRecoveryProvider>,
      );

      expect(screen.getByTestId('has-recovered').textContent).toBe('false');
    });
  });
});
