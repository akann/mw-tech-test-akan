import axios, { AxiosError } from 'axios';
import { parseStringPromise } from 'xml2js';

import { VehicleValuation } from '@app/models/vehicle-valuation';
import { ProviderLog } from '@app/models';
import { CarValuationResponse } from '../types/car-valuation-response';

// should be in a config module so it can be validated
export const PREMUIM_CAR_BASE_URL =
  process.env.PREMUIM_CAR_BASE_URL ||
  'https://run.mocky.io/v3/6460ac02-fc5b-47ef-85f5-bf4affc7c0de';

export async function fetchValuationFromPremiumCarValuation(
  vrm: string,
): Promise<CarValuationResponse> {
  const providerLog = new ProviderLog();
  providerLog.vrm = vrm;
  providerLog.requestUrl = `${PREMUIM_CAR_BASE_URL}/valueCar?vrm=${vrm}`;
  providerLog.requestDate = new Date();
  providerLog.providerName = 'PremiumCar';

  const startTime = performance.now();

  let valuation: VehicleValuation | undefined = undefined;

  try {
    axios.defaults.baseURL = PREMUIM_CAR_BASE_URL;
    await axios
      .get(`/valueCar?vrm=${vrm}`, {
        headers: {
          Accept: 'application/xml',
        },
      })
      .then(async (response) => {
        providerLog.responseCode = response.status;
        providerLog.requestDuration = performance.now() - startTime;

        const xml = await parseStringPromise(response.data, {
          explicitArray: false,
        });
        valuation = new VehicleValuation();
        valuation.highestValue = parseInt(
          xml.Response.ValuationPrivateSaleMinimum,
        );
        valuation.lowestValue = parseInt(
          xml.Response.ValuationPrivateSaleMaximum,
        );
        valuation.vrm = vrm;
      });
  } catch (error) {
    providerLog.errorMessage = (error as AxiosError).message;
    providerLog.responseCode = (error as AxiosError).response?.status || 503;
    providerLog.requestDuration = performance.now() - startTime;
  }

  return { valuation, providerLog };
}
