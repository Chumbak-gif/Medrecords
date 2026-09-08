/**
 * Tests for inactivity timeout monitor.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createInactivityMonitor } from './inactivityMonitor';

describe('inactivityMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call onTimeout after the specified timeout period', () => {
    const onTimeout = vi.fn();
    const monitor = createInactivityMonitor({ onTimeout, timeoutMs: 5000 });
    monitor.start();

    vi.advanceTimersByTime(5000);
    expect(onTimeout).toHaveBeenCalledTimes(1);

    monitor.stop();
  });

  it('should not call onTimeout before the timeout period', () => {
    const onTimeout = vi.fn();
    const monitor = createInactivityMonitor({ onTimeout, timeoutMs: 5000 });
    monitor.start();

    vi.advanceTimersByTime(4999);
    expect(onTimeout).not.toHaveBeenCalled();

    monitor.stop();
  });

  it('should reset timer on activity events', () => {
    const onTimeout = vi.fn();
    const monitor = createInactivityMonitor({ onTimeout, timeoutMs: 5000 });
    monitor.start();

    // Advance 3 seconds
    vi.advanceTimersByTime(3000);
    expect(onTimeout).not.toHaveBeenCalled();

    // Simulate user activity
    document.dispatchEvent(new Event('mousemove'));

    // Advance another 3 seconds (total 6s from start, but only 3s from last activity)
    vi.advanceTimersByTime(3000);
    expect(onTimeout).not.toHaveBeenCalled();

    // Advance 2 more seconds (5s from last activity)
    vi.advanceTimersByTime(2000);
    expect(onTimeout).toHaveBeenCalledTimes(1);

    monitor.stop();
  });

  it('should stop monitoring when stop() is called', () => {
    const onTimeout = vi.fn();
    const monitor = createInactivityMonitor({ onTimeout, timeoutMs: 5000 });
    monitor.start();
    monitor.stop();

    vi.advanceTimersByTime(10000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('should default to 15 minutes if no timeoutMs provided', () => {
    const onTimeout = vi.fn();
    const monitor = createInactivityMonitor({ onTimeout });
    monitor.start();

    // 14 minutes should not trigger
    vi.advanceTimersByTime(14 * 60 * 1000);
    expect(onTimeout).not.toHaveBeenCalled();

    // 15 minutes should trigger
    vi.advanceTimersByTime(60 * 1000);
    expect(onTimeout).toHaveBeenCalledTimes(1);

    monitor.stop();
  });

  it('should allow reset() to restart the timer', () => {
    const onTimeout = vi.fn();
    const monitor = createInactivityMonitor({ onTimeout, timeoutMs: 5000 });
    monitor.start();

    vi.advanceTimersByTime(3000);
    monitor.reset();

    vi.advanceTimersByTime(3000);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);
    expect(onTimeout).toHaveBeenCalledTimes(1);

    monitor.stop();
  });
});
