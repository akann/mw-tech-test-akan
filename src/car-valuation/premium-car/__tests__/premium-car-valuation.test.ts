import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { ProviderLog, VehicleValuation } from '@app/models';
import {
  fetchValuationFromPremiumCarValuation,
  PREMUIM_CAR_BASE_URL,
} from '../premium-car-valuation';

describe('fetchValuationFromPremiumCarValuation', () => {
  const baseURL = PREMUIM_CAR_BASE_URL;
  let mockAxios: MockAdapter;

  beforeEach(() => {
    vi.resetAllMocks();
    axios.defaults.baseURL = baseURL;
    mockAxios = new MockAdapter(axios);

    vi.useFakeTimers();

    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(1988);
  });

  afterEach(() => {
    mockAxios.restore();
    vi.useRealTimers();
  });

  it('should return a valid valuation when the request is successful', async () => {
    const vrm = 'ABC123';
    const mockResponse = `
<?xml version="1.0" encoding="UTF-8"?>
<Response>
	<RegistrationDate>2012-06-14T00:00:00.0000000</RegistrationDate>
	<RegistrationYear>2001</RegistrationYear>
	<RegistrationMonth>10</RegistrationMonth>
	<ValuationPrivateSaleMinimum>11500</ValuationPrivateSaleMinimum>
	<ValuationPrivateSaleMaximum>12750</ValuationPrivateSaleMaximum>
	<ValuationDealershipMinimum>9500</ValuationDealershipMinimum>
	<ValuationDealershipMaximum>10275</ValuationDealershipMaximum>
</Response>`;

    mockAxios.onGet(`${baseURL}/valueCar?vrm=${vrm}`).reply(200, mockResponse);

    const { valuation, providerLog } =
      await fetchValuationFromPremiumCarValuation(vrm);

    expect(providerLog).toBeInstanceOf(ProviderLog);
    expect(providerLog.vrm).toBe(vrm);
    expect(providerLog.providerName).toBe('PremiumCar');
    expect(providerLog.requestUrl).toBe(`${baseURL}/valueCar?vrm=${vrm}`);
    expect(providerLog.responseCode).toBe(200);
    expect(providerLog.requestDuration).toBe(1988);

    expect(valuation).toBeInstanceOf(VehicleValuation);
    expect(valuation?.highestValue).toBe(11500);
    expect(valuation?.lowestValue).toBe(12750);
  });

  it('should handle a 404 error when the vehicle is not found', async () => {
    const vrm = 'NOTFOUND';

    mockAxios.onGet(`${baseURL}/valueCar?vrm=${vrm}`).reply(404);
    const { valuation, providerLog } =
      await fetchValuationFromPremiumCarValuation(vrm);

    expect(providerLog).toBeInstanceOf(ProviderLog);
    expect(providerLog.vrm).toBe(vrm);
    expect(providerLog.providerName).toBe('PremiumCar');
    expect(providerLog.requestUrl).toBe(`${baseURL}/valueCar?vrm=${vrm}`);
    expect(providerLog.responseCode).toBe(404);
    expect(providerLog.requestDuration).toBe(1988);
    expect(providerLog.errorMessage).toBe(
      'Request failed with status code 404',
    );

    expect(valuation).toBeUndefined();
  });

  it('should handle a 500 error when the server fails', async () => {
    const vrm = 'SERVERERROR';

    mockAxios.onGet(`${baseURL}/valueCar?vrm=${vrm}`).reply(500);

    const { valuation, providerLog } =
      await fetchValuationFromPremiumCarValuation(vrm);

    expect(providerLog).toBeInstanceOf(ProviderLog);
    expect(providerLog.vrm).toBe(vrm);
    expect(providerLog.providerName).toBe('PremiumCar');
    expect(providerLog.requestUrl).toBe(`${baseURL}/valueCar?vrm=${vrm}`);
    expect(providerLog.responseCode).toBe(500);
    expect(providerLog.requestDuration).toBe(1988);
    expect(providerLog.errorMessage).toBe(
      'Request failed with status code 500',
    );

    expect(valuation).toBeUndefined();
  });

  it('should handle network errors', async () => {
    const vrm = 'NETWORKERROR';

    mockAxios.onGet(`${baseURL}/valueCar?vrm=${vrm}`).networkError();

    const { valuation, providerLog } =
      await fetchValuationFromPremiumCarValuation(vrm);

    expect(providerLog).toBeInstanceOf(ProviderLog);
    expect(providerLog.vrm).toBe(vrm);
    expect(providerLog.providerName).toBe('PremiumCar');
    expect(providerLog.requestUrl).toBe(`${baseURL}/valueCar?vrm=${vrm}`);
    expect(providerLog.responseCode).toBe(503);
    expect(providerLog.requestDuration).toBe(1988);
    expect(providerLog.errorMessage).toBe('Network Error');

    expect(valuation).toBeUndefined();
  });
});
