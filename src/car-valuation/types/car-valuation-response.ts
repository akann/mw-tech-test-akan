import { ProviderLog, VehicleValuation } from '@app/models';

export type CarValuationResponse = {
  providerLog: ProviderLog;
  valuation?: VehicleValuation;
};
