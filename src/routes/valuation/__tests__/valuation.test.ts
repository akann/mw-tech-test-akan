import nock from 'nock';
import { fastify } from '~root/test/fastify';
import { VehicleValuationRequest } from '../types/vehicle-valuation-request';
import { VehicleValuation } from '@app/models/vehicle-valuation';
import { SuperCarValuationResponse } from '@app/car-valuation/super-car/types/super-car-valuation-response';
import { ProviderLog } from '@app/models';
import { PREMUIM_CAR_BASE_URL } from '@app/car-valuation/premium-car/premium-car-valuation';
import { SUPER_CAR_BASE_URL } from '@app/car-valuation/super-car/super-car-valuation';

describe('ValuationController (e2e)', () => {
  const mockSuperCarResponse: SuperCarValuationResponse = {
    vin: '123',
    registrationDate: '2021-01-01',
    plate: {
      year: 2021,
      month: 1,
    },
    valuation: {
      lowerValue: 5000,
      upperValue: 7000,
    },
  };
  const mockPremiumResponse = `
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

  beforeEach(async () => {
    await fastify.orm.getRepository(VehicleValuation).delete({});
    await fastify.orm.getRepository(ProviderLog).delete({});
  });

  afterEach(() => {
    nock.cleanAll();
    vi.restoreAllMocks();
    fastify.failoverManager.resetFailoverStatus();
  });

  describe('PUT /valuations/:vrm', () => {
    it('should return 404 if VRM is missing', async () => {
      const requestBody: VehicleValuationRequest = {
        mileage: 10000,
      };

      const res = await fastify.inject({
        url: '/valuations',
        method: 'PUT',
        body: requestBody,
      });

      expect(res.statusCode).toStrictEqual(404);
    });

    it('should return 400 if VRM is 8 characters or more', async () => {
      const requestBody: VehicleValuationRequest = {
        mileage: 10000,
      };

      const res = await fastify.inject({
        url: '/valuations/12345678',
        body: requestBody,
        method: 'PUT',
      });

      expect(res.statusCode).toStrictEqual(400);
    });

    it('should return 400 if mileage is missing', async () => {
      const requestBody: VehicleValuationRequest = {
        // @ts-expect-error intentionally malformed payload
        mileage: null,
      };

      const res = await fastify.inject({
        url: '/valuations/ABC123',
        body: requestBody,
        method: 'PUT',
      });

      expect(res.statusCode).toStrictEqual(400);
    });

    it('should return 400 if mileage is negative', async () => {
      const requestBody: VehicleValuationRequest = {
        mileage: -1,
      };

      const res = await fastify.inject({
        url: '/valuations/ABC123',
        body: requestBody,
        method: 'PUT',
      });

      expect(res.statusCode).toStrictEqual(400);
    });

    it('should return 503 if both providers are unreachable or return a 5xx error', async () => {
      const vrm = 'ABC123';
      const mileage = 10000;

      const scope = nock(SUPER_CAR_BASE_URL)
        .get(`/valuations/${vrm}?mileage=${mileage}`)
        .replyWithError('Service Unavailable');

      for (let i = 0; i < 10; i++) {
        const r = await fastify.inject({
          method: 'PUT',
          url: `/valuations/${vrm}`,
          payload: { mileage },
        });
        expect(r.statusCode).toBe(503);
      }

      const requestBody: VehicleValuationRequest = {
        mileage: 10000,
      };

      const premiumCarScope = nock(PREMUIM_CAR_BASE_URL)
        .get(`/valueCar?vrm=${vrm}`)
        .replyWithError('Service Unavailable');

      const res = await fastify.inject({
        url: `/valuations/${vrm}`,
        body: requestBody,
        method: 'PUT',
      });

      expect(res.statusCode).toStrictEqual(503);

      expect(res.json()).toEqual({
        message: 'Service Unavailable',
        statusCode: 503,
      });

      expect(scope.isDone()).toBe(true);
      expect(premiumCarScope.isDone()).toBe(true);
    });

    it('should handle duplicate VRM entry without and return valid data', async () => {
      const vrm = 'ABC123';
      const mileage = 10000;
      const mockResponse = {
        valuation: {
          lowerValue: 5000,
          upperValue: 7000,
        },
      };

      const superCarScope = nock(SUPER_CAR_BASE_URL)
        .get(`/valuations/${vrm}?mileage=${mileage}`)
        .reply(200, mockResponse);
      const premiumCarScope = nock(PREMUIM_CAR_BASE_URL)
        .get(`/valueCar?vrm=${vrm}`)
        .reply(200, mockResponse);

      const newValuation = { vrm, lowestValue: 5000, highestValue: 7000 };
      await fastify.orm.getRepository(VehicleValuation).insert(newValuation);
      const newProviderLog = {
        providerName: 'SuperCar',
        requestUrl: `https://run.mocky.io/v3/04565792-82c3-4d44-8e82-052bf5d03a24/valuations/${vrm}?mileage=10000`,
        responseCode: 200,
        vrm,
        requestDuration: 1000,
        requestDate: new Date(),
      };
      await fastify.orm.getRepository(ProviderLog).insert(newProviderLog);

      const requestBody: VehicleValuationRequest = {
        mileage,
      };

      const res = await fastify.inject({
        url: `/valuations/${vrm}`,
        body: requestBody,
        method: 'PUT',
      });

      expect(res.statusCode).toStrictEqual(200);

      const { valuation, providerLog } = res.json();
      expect(valuation).toEqual({
        highestValue: 7000,
        lowestValue: 5000,
        vrm,
      });

      expect(providerLog.providerName).toBe('SuperCar');
      expect(providerLog.requestUrl).toBe(
        `https://run.mocky.io/v3/04565792-82c3-4d44-8e82-052bf5d03a24/valuations/${vrm}?mileage=10000`,
      );
      expect(providerLog.responseCode).toBe(200);
      expect(providerLog.vrm).toBe(vrm);
      expect(providerLog.requestDuration).toBe(1000);
      expect(providerLog.requestDate).toBeDefined();

      expect(superCarScope.isDone()).toBe(false);
      expect(premiumCarScope.isDone()).toBe(false);
    });

    it('should return 200 with valid request', async () => {
      const vrm = 'ABC123';
      const scope = nock(SUPER_CAR_BASE_URL)
        .get(`/valuations/${vrm}?mileage=10000`)
        .reply(200, mockSuperCarResponse);

      const requestBody: VehicleValuationRequest = {
        mileage: 10000,
      };

      const res = await fastify.inject({
        url: `/valuations/${vrm}`,
        body: requestBody,
        method: 'PUT',
      });

      expect(res.statusCode).toStrictEqual(200);

      const { valuation, providerLog } = res.json();
      expect(valuation).toEqual({
        highestValue: 7000,
        lowestValue: 5000,
        vrm,
      });

      expect(providerLog.providerName).toBe('SuperCar');
      expect(providerLog.requestUrl).toBe(
        `https://run.mocky.io/v3/04565792-82c3-4d44-8e82-052bf5d03a24/valuations/${vrm}?mileage=10000`,
      );
      expect(providerLog.responseCode).toBe(200);
      expect(providerLog.vrm).toBe(vrm);
      expect(providerLog.requestDuration).toBeGreaterThan(0);
      expect(providerLog.requestDate).toBeDefined();

      expect(scope.isDone()).toBe(true);
    });

    it('should return 200 with valid request - failover to Premium Car', async () => {
      const vrm = 'ABC123';
      const mileage = 10000;

      const scope = nock(SUPER_CAR_BASE_URL)
        .get(`/valuations/${vrm}?mileage=${mileage}`)
        .reply(500);

      for (let i = 0; i < 10; i++) {
        await fastify.inject({
          method: 'PUT',
          url: `/valuations/${vrm}`,
          payload: { mileage },
        });
      }

      const requestBody: VehicleValuationRequest = {
        mileage,
      };

      const premiumCarScope = nock(PREMUIM_CAR_BASE_URL)
        .get(`/valueCar?vrm=${vrm}`)
        .reply(200, mockPremiumResponse);

      const res = await fastify.inject({
        url: `/valuations/${vrm}`,
        body: requestBody,
        method: 'PUT',
      });

      expect(res.statusCode).toStrictEqual(200);

      const { valuation, providerLog } = res.json();
      expect(valuation).toEqual({
        highestValue: 11500,
        lowestValue: 12750,
        vrm,
      });

      expect(providerLog.providerName).toBe('PremiumCar');
      expect(providerLog.requestUrl).toBe(
        `${PREMUIM_CAR_BASE_URL}/valueCar?vrm=${vrm}`,
      );
      expect(providerLog.responseCode).toBe(200);
      expect(providerLog.vrm).toBe(vrm);
      expect(providerLog.requestDuration).toBeGreaterThan(0);
      expect(providerLog.requestDate).toBeDefined();

      expect(scope.isDone()).toBe(true);
      expect(premiumCarScope.isDone()).toBe(true);
    });
  });

  describe('GET /valuations/:vrm', () => {
    it('should return 400 if VRM param is not present', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/valuations/',
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe('vrm must be 7 characters or less');
    });

    it('should return 400 if VRM is 8 characters or more', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/valuations/ABC12345',
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().message).toBe('vrm must be 7 characters or less');
    });

    it('should return 404 if valuation is not found', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/valuations/ABC1234',
      });
      expect(response.statusCode).toBe(404);
      expect(response.json().message).toBe(
        'Valuation for VRM ABC1234 not found',
      );
    });

    it('should return the valuation if found', async () => {
      const vrm = 'ABC1234';
      const newValuation = { vrm, lowestValue: 10000, highestValue: 20000 };
      await fastify.orm.getRepository(VehicleValuation).insert(newValuation);
      const newProviderLog = {
        providerName: 'SuperCar',
        requestUrl: `https://run.mocky.io/v3/04565792-82c3-4d44-8e82-052bf5d03a24/valuations/${vrm}?mileage=10000`,
        responseCode: 200,
        vrm,
        requestDuration: 1000,
        requestDate: new Date(),
      };
      await fastify.orm.getRepository(ProviderLog).insert(newProviderLog);

      const response = await fastify.inject({
        method: 'GET',
        url: `/valuations/${vrm}`,
      });

      const { valuation, providerLog } = response.json();
      expect(valuation).toEqual({
        highestValue: 20000,
        lowestValue: 10000,
        vrm,
      });
      expect(response.statusCode).toBe(200);
      expect(providerLog.providerName).toBe('SuperCar');
      expect(providerLog.requestUrl).toBe(
        `https://run.mocky.io/v3/04565792-82c3-4d44-8e82-052bf5d03a24/valuations/${vrm}?mileage=10000`,
      );
      expect(providerLog.responseCode).toBe(200);
      expect(providerLog.vrm).toBe(vrm);
      expect(providerLog.requestDuration).toBe(1000);
      expect(providerLog.requestDate).toBeDefined();
    });

    it('should return the valuation without log if found with no log - backward compatibilty', async () => {
      const vrm = 'ABC1234';
      const newValuation = { vrm, lowestValue: 10000, highestValue: 20000 };
      await fastify.orm.getRepository(VehicleValuation).insert(newValuation);

      const response = await fastify.inject({
        method: 'GET',
        url: `/valuations/${vrm}`,
      });
      expect(response.statusCode).toBe(200);

      const { valuation, providerLog } = response.json();
      expect(valuation).toEqual({
        highestValue: 20000,
        lowestValue: 10000,
        vrm,
      });

      expect(providerLog).toBeNull();
    });
  });
});
