import { FastifyInstance } from 'fastify';
import { VehicleValuationRequest } from './types/vehicle-valuation-request';
import { VehicleValuation } from '@app/models/vehicle-valuation';
import { fetchCarValuation } from '@app/car-valuation/fetch-car-valuation';
import { ProviderLog } from '@app/models';
import { FailoverManager } from '@app/utils/failover-manager';

declare module 'fastify' {
  interface FastifyInstance {
    failoverManager: FailoverManager;
  }
}

export function valuationRoutes(fastify: FastifyInstance) {
  fastify.decorate('failoverManager', new FailoverManager());
  fastify.get<{
    Params: {
      vrm: string;
    };
  }>('/valuations/:vrm', async (request, reply) => {
    const valuationRepository = fastify.orm.getRepository(VehicleValuation);
    const { vrm } = request.params;

    if (vrm === null || vrm === '' || vrm.length > 7) {
      return reply
        .code(400)
        .send({ message: 'vrm must be 7 characters or less', statusCode: 400 });
    }

    const valuation = await valuationRepository.findOneBy({ vrm: vrm });
    const providerLog = await fastify.orm.getRepository(ProviderLog).findOne({
      where: { vrm },
      order: { requestDate: 'DESC' },
    });

    if (valuation == null) {
      return reply.code(404).send({
        message: `Valuation for VRM ${vrm} not found`,
        statusCode: 404,
      });
    }

    return { valuation, providerLog };
  });

  fastify.put<{
    Body: VehicleValuationRequest;
    Params: {
      vrm: string;
    };
  }>('/valuations/:vrm', async (request, reply) => {
    const { vrm } = request.params;
    const { mileage } = request.body;

    if (!vrm?.length) {
      return reply
        .code(404)
        .send({ message: 'vrm must provided', statusCode: 404 });
    }

    if (vrm.length > 7) {
      return reply
        .code(400)
        .send({ message: 'vrm must be 7 characters or less', statusCode: 400 });
    }

    if (mileage === null || mileage <= 0) {
      return reply.code(400).send({
        message: 'mileage must be a positive number',
        statusCode: 400,
      });
    }

    const { valuation, providerLog } = await fetchCarValuation(
      fastify.failoverManager,
      fastify.orm,
      vrm,
      mileage,
    );

    if (!valuation) {
      return reply.code(providerLog.responseCode).send({
        message: providerLog?.errorMessage,
        statusCode: providerLog.responseCode,
      });
    }

    fastify.log.info('Valuation created: ', valuation);

    return { valuation, providerLog };
  });
}
