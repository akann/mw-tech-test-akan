import { ProviderLog, VehicleValuation } from '@app/models';
import { fetchValuationFromSuperCarValuation } from './super-car/super-car-valuation';
import { fetchValuationFromPremiumCarValuation } from './premium-car/premium-car-valuation';
import { DataSource } from 'typeorm';
import { CarValuationResponse } from './types/car-valuation-response';
import { FailoverManager } from '@app/utils/failover-manager';

export const fetchCarValuation = async (
  failoverManager: FailoverManager,
  orm: DataSource,
  vrm: string,
  mileage: number,
): Promise<CarValuationResponse> => {
  const valuationRepository = orm.getRepository(VehicleValuation);
  const providerLogsRepository = orm.getRepository(ProviderLog);

  const lastProviderLog = await providerLogsRepository.findOne({
    where: { vrm },
    order: { requestDate: 'DESC' },
  });

  const existingValuation = await valuationRepository.findOneBy({ vrm });

  if (existingValuation) {
    return {
      valuation: existingValuation,
      providerLog: lastProviderLog || new ProviderLog(),
    };
  }

  let valuation: VehicleValuation | undefined = undefined;
  let providerLog: ProviderLog = new ProviderLog();

  if (failoverManager.shouldUseFallbackProvider()) {
    const premiumCarValuation =
      await fetchValuationFromPremiumCarValuation(vrm);
    valuation = premiumCarValuation.valuation;
    providerLog = premiumCarValuation.providerLog;
  } else {
    const superCarValuation = await fetchValuationFromSuperCarValuation(
      vrm,
      mileage,
    );
    valuation = superCarValuation.valuation;
    providerLog = superCarValuation.providerLog;
    if (providerLog.responseCode === 200) {
      failoverManager.recordSuccess();
    } else {
      failoverManager.recordFailure();
    }
  }

  // TODO: catch error and do something with it.
  await providerLogsRepository.insert(providerLog);

  if (valuation) {
    // Save to DB.
    await valuationRepository.insert(valuation).catch((err) => {
      if (err.code !== 'SQLITE_CONSTRAINT') {
        throw err;
      }
    });
  }

  return { valuation, providerLog };
};
