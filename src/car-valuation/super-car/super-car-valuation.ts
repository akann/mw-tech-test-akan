import axios, { AxiosError } from 'axios';

import { VehicleValuation } from '../../models';
import { SuperCarValuationResponse } from './types/super-car-valuation-response';
import { ProviderLog } from '@app/models';
import { CarValuationResponse } from '../types/car-valuation-response';

export const SUPER_CAR_BASE_URL =
  'https://run.mocky.io/v3/e519150f-e506-4003-8f8a-6a8a799981fc';

export async function fetchValuationFromSuperCarValuation(
  vrm: string,
  mileage: number,
): Promise<CarValuationResponse> {
  const providerLog = new ProviderLog();
  providerLog.vrm = vrm;
  providerLog.requestUrl = `${SUPER_CAR_BASE_URL}/valuations/${vrm}?mileage=${mileage}`;
  providerLog.requestDate = new Date();
  providerLog.providerName = 'SuperCar';

  const startTime = performance.now();

  let valuation: VehicleValuation | undefined = undefined;

  try {
    axios.defaults.baseURL = SUPER_CAR_BASE_URL;
    await axios
      .get<SuperCarValuationResponse>(`/valuations/${vrm}?mileage=${mileage}`)
      .then((response) => {
        providerLog.responseCode = response.status;
        providerLog.requestDuration = performance.now() - startTime;

        const json = response.data;
        valuation = new VehicleValuation();
        valuation.vrm = vrm;
        valuation.highestValue = json.valuation.upperValue;
        valuation.lowestValue = json.valuation.lowerValue;
      });
  } catch (error) {
    providerLog.errorMessage = (error as AxiosError).message;
    providerLog.responseCode = (error as AxiosError).response?.status || 503;
    providerLog.requestDuration = performance.now() - startTime;
  }

  return { valuation, providerLog };
}
