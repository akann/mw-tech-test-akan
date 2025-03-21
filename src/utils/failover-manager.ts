export enum ProviderStatus {
  SUCCESS,
  FAILURE,
}

export interface ProviderStatusRecord {
  status: ProviderStatus;
  timestamp: number;
}

export class FailoverManager {
  private primaryProviderStatuses: ProviderStatusRecord[] = [];
  private usingFallbackProvider: boolean = false;
  private fallbackStartTime: number = 0;

  private windowSize = 10; // 100 requests
  private failureThreshold = 50; // 50% failure rate
  private cooldownPeriod = 10 * 60 * 1000; // 10 minutes by default;

  constructor() {}

  public recordSuccess(): void {
    this.addStatusRecord(ProviderStatus.SUCCESS);
    this.checkForRevert();
  }

  public recordFailure(): void {
    this.addStatusRecord(ProviderStatus.FAILURE);
  }

  public shouldUseFallbackProvider(): boolean {
    // If already using fallback, continue using it until cooldown period expires
    if (this.usingFallbackProvider) {
      return true;
    }

    const failureRate = this.calculateFailureRate();
    if (failureRate >= this.failureThreshold) {
      this.usingFallbackProvider = true;
      this.fallbackStartTime = Date.now();
      return true;
    }

    return false;
  }

  public resetFailoverStatus(): void {
    this.usingFallbackProvider = false;
    this.primaryProviderStatuses = [];
  }

  private addStatusRecord(status: ProviderStatus): void {
    const now = Date.now();
    this.primaryProviderStatuses.push({ status, timestamp: now });

    // Maintain window size by removing oldest entries
    if (this.primaryProviderStatuses.length > this.windowSize) {
      this.primaryProviderStatuses.shift();
    }
  }

  private calculateFailureRate(): number {
    if (this.primaryProviderStatuses.length === 0) {
      return 0;
    }

    const failureCount = this.primaryProviderStatuses.filter(
      (record) => record.status === ProviderStatus.FAILURE,
    ).length;

    return (failureCount / this.primaryProviderStatuses.length) * 100;
  }

  private checkForRevert(): void {
    if (!this.usingFallbackProvider) {
      return;
    }

    const now = Date.now();
    if (now - this.fallbackStartTime >= this.cooldownPeriod) {
      this.resetFailoverStatus();
    }
  }
}
