import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {
  fetchValuationFromSuperCarValuation,
  SUPER_CAR_BASE_URL,
} from '../super-car-valuation';
import { ProviderLog, VehicleValuation } from '@app/models';

describe('fetchValuationFromSuperCarValuation', () => {
  const baseURL = SUPER_CAR_BASE_URL;
  let mockAxios: MockAdapter;

  beforeEach(() => {
    vi.resetAllMocks();
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
    const mileage = 10000;
    const mockResponse = {
      valuation: {
        upperValue: 20000,
        lowerValue: 18000,
      },
    };

    mockAxios
      .onGet(`${baseURL}/valuations/${vrm}?mileage=${mileage}`)
      .reply(200, mockResponse);

    const { valuation, providerLog } =
      await fetchValuationFromSuperCarValuation(vrm, mileage);

    expect(providerLog).toBeInstanceOf(ProviderLog);
    expect(providerLog.vrm).toBe(vrm);
    expect(providerLog.providerName).toBe('SuperCar');
    expect(providerLog.requestUrl).toBe(
      `${baseURL}/valuations/${vrm}?mileage=${mileage}`,
    );
    expect(providerLog.requestDate).toBeInstanceOf(Date);
    expect(providerLog.responseCode).toBe(200);
    expect(providerLog.requestDuration).toBe(1988);

    expect(valuation).toBeInstanceOf(VehicleValuation);
    expect(valuation?.highestValue).toBe(20000);
    expect(valuation?.lowestValue).toBe(18000);
  });

  it('should handle a 404 error when the vehicle is not found', async () => {
    const vrm = 'NOTFOUND';
    const mileage = 10000;

    mockAxios
      .onGet(`${baseURL}/valuations/${vrm}?mileage=${mileage}`)
      .reply(404);

    const { valuation, providerLog } =
      await fetchValuationFromSuperCarValuation(vrm, mileage);

    expect(providerLog).toBeInstanceOf(ProviderLog);
    expect(providerLog.vrm).toBe(vrm);
    expect(providerLog.providerName).toBe('SuperCar');
    expect(providerLog.requestUrl).toBe(
      `${baseURL}/valuations/${vrm}?mileage=${mileage}`,
    );
    expect(providerLog.responseCode).toBe(404);
    expect(providerLog.requestDuration).toBe(1988);
    expect(providerLog.errorMessage).toBe(
      'Request failed with status code 404',
    );

    expect(valuation).toBeUndefined();
  });

  it('should handle a 500 error when the server fails', async () => {
    const vrm = 'SERVERERROR';
    const mileage = 10000;

    mockAxios
      .onGet(`${baseURL}/valuations/${vrm}?mileage=${mileage}`)
      .reply(500);

    const { valuation, providerLog } =
      await fetchValuationFromSuperCarValuation(vrm, mileage);

    expect(providerLog).toBeInstanceOf(ProviderLog);
    expect(providerLog.vrm).toBe(vrm);
    expect(providerLog.providerName).toBe('SuperCar');
    expect(providerLog.requestUrl).toBe(
      `${baseURL}/valuations/${vrm}?mileage=${mileage}`,
    );
    expect(providerLog.responseCode).toBe(500);
    expect(providerLog.requestDuration).toBe(1988);
    expect(providerLog.errorMessage).toBe(
      'Request failed with status code 500',
    );

    expect(valuation).toBeUndefined();
  });

  it('should handle network errors', async () => {
    const vrm = 'NETWORKERROR';
    const mileage = 10000;

    mockAxios
      .onGet(`${baseURL}/valuations/${vrm}?mileage=${mileage}`)
      .networkError();

    const { valuation, providerLog } =
      await fetchValuationFromSuperCarValuation(vrm, mileage);

    expect(providerLog).toBeInstanceOf(ProviderLog);
    expect(providerLog.vrm).toBe(vrm);
    expect(providerLog.providerName).toBe('SuperCar');
    expect(providerLog.requestUrl).toBe(
      `${baseURL}/valuations/${vrm}?mileage=${mileage}`,
    );
    expect(providerLog.responseCode).toBe(503);
    expect(providerLog.requestDuration).toBe(1988);
    expect(providerLog.errorMessage).toBe('Network Error');

    expect(valuation).toBeUndefined();
  });
});
