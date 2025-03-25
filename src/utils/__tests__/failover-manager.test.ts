import { FailoverManager } from '../failover-manager';

describe('FailoverManager', () => {
  let failoverManager: FailoverManager;

  beforeEach(() => {
    failoverManager = new FailoverManager(10, 50, 10 * 60 * 1000);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial state', () => {
    it('should not use fallback provider by default', () => {
      expect(failoverManager.shouldUseFallbackProvider()).toBe(false);
    });
  });

  describe('Failure rate calculation', () => {
    it('should use fallback when failure rate exceeds threshold', () => {
      // Simulate 6 failures out of 10 requests (60% failure rate)
      for (let i = 0; i < 6; i++) {
        failoverManager.recordFailure();
      }
      for (let i = 0; i < 4; i++) {
        failoverManager.recordSuccess();
      }

      expect(failoverManager.shouldUseFallbackProvider()).toBe(true);
    });

    it('should not use fallback when failure rate is below threshold', () => {
      // Simulate 4 failures out of 10 requests (40% failure rate)
      for (let i = 0; i < 4; i++) {
        failoverManager.recordFailure();
      }
      for (let i = 0; i < 6; i++) {
        failoverManager.recordSuccess();
      }

      expect(failoverManager.shouldUseFallbackProvider()).toBe(false);
    });

    it('should maintain the window size by removing oldest records', () => {
      // Create a new instance for this test to isolate behavior
      const manager = new FailoverManager(10, 50, 10 * 60 * 1000);

      // First, add 5 failures (not enough to trigger fallback)
      for (let i = 0; i < 5; i++) {
        manager.recordFailure();
      }

      // Add 5 successes to fill the window with 5 failures, 5 successes (50% rate)
      for (let i = 0; i < 5; i++) {
        manager.recordSuccess();
      }

      // At exactly 50% failure rate, should use fallback
      expect(manager.shouldUseFallbackProvider()).toBe(true);

      // Reset the manager to clear the fallback state
      manager.resetFailoverStatus();

      // Now add 10 more successes to push out all failures from the window
      for (let i = 0; i < 10; i++) {
        manager.recordSuccess();
      }

      // Now window should have only successes, so shouldn't use fallback
      expect(manager.shouldUseFallbackProvider()).toBe(false);
    });
  });

  describe('Cooldown period', () => {
    it('should continue using fallback during cooldown period', () => {
      // Trigger fallback mode
      for (let i = 0; i <= 10; i++) {
        failoverManager.recordFailure();
      }

      expect(failoverManager.shouldUseFallbackProvider()).toBe(true);

      // Add successful requests, but not enough time has passed
      for (let i = 0; i < 10; i++) {
        failoverManager.recordSuccess();
      }

      // Should still be using fallback
      expect(failoverManager.shouldUseFallbackProvider()).toBe(true);
    });

    it('should revert to primary after cooldown period', () => {
      // Trigger fallback mode
      for (let i = 0; i <= 10; i++) {
        failoverManager.recordFailure();
      }

      expect(failoverManager.shouldUseFallbackProvider()).toBe(true);

      // Advance time by cooldown period
      vi.advanceTimersByTime(10 * 60 * 1000);

      // Record a success which should trigger check for revert
      failoverManager.recordSuccess();

      // Should no longer be using fallback
      expect(failoverManager.shouldUseFallbackProvider()).toBe(false);
    });
  });

  describe('Manual reset', () => {
    it('should reset fallback status when explicitly requested', () => {
      // Trigger fallback mode
      for (let i = 0; i <= 10; i++) {
        failoverManager.recordFailure();
      }

      expect(failoverManager.shouldUseFallbackProvider()).toBe(true);

      // Manually reset
      failoverManager.resetFailoverStatus();

      // Should no longer be using fallback
      expect(failoverManager.shouldUseFallbackProvider()).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty status history', () => {
      expect(failoverManager.shouldUseFallbackProvider()).toBe(false);
    });

    it('should handle exactly threshold failure rate', () => {
      // Simulate 5 failures out of 10 requests (50% failure rate)
      for (let i = 0; i < 5; i++) {
        failoverManager.recordFailure();
      }
      for (let i = 0; i < 5; i++) {
        failoverManager.recordSuccess();
      }

      // Should use fallback at exactly threshold
      expect(failoverManager.shouldUseFallbackProvider()).toBe(true);
    });
  });
});
