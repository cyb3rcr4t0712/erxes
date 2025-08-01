import {
  MessageArgs,
  MessageArgsOmitService,
  sendMessage,
} from '@erxes/api-utils/src/core';
import { Syncpolariss } from './models';
import { afterMutationHandlers } from './afterMutations';
import {
  consumeRPCQueue,
  consumeQueue,
} from '@erxes/api-utils/src/messageBroker';
import { createLoanSchedule } from './utils/loan/createSchedule';
import { getDepositBalance } from './utils/deposit/getDepositBalance';
import { createLoanStoreInterest } from './utils/loan/loanStoreInterest';
import { changeLoanSchedule } from './utils/loan/changeLoanSchedule';
import { getConfig } from './utils/utils';
import { createSavingMessage } from './utils/saving/createSavingMessage';
import { createLoanMessage } from './utils/loan/createLoanMessage';
import { activeSaving } from './utils/saving/activeSaving';
import { activeLoan } from './utils/loan/activeLoan';
import { createCollateral } from './utils/collateral/createCollateral';
import { createDeposit } from './utils/deposit/createDeposit';
import { activeDeposit } from './utils/deposit/activeDeposit';

export const setupMessageConsumers = async () => {
  consumeQueue('syncpolaris:afterMutation', async ({ subdomain, data }) => {
    await afterMutationHandlers(subdomain, data);
  });

  consumeQueue('syncpolaris:send', async ({ data }) => {
    Syncpolariss.send(data);

    return {
      status: 'success',
    };
  });

  consumeRPCQueue(
    'syncpolaris:sendSavingContract',
    async ({ data, subdomain }) => {
      const polarisConfig = await getConfig(subdomain, 'POLARIS', {});

      return {
        status: 'success',
        data: await createSavingMessage(subdomain, polarisConfig, data),
      };
    }
  );

  consumeRPCQueue(
    'syncpolaris:savingContractActive',
    async ({ data, subdomain }) => {
      const polarisConfig = await getConfig(subdomain, 'POLARIS', {});

      return {
        status: 'success',
        data: await activeSaving(subdomain, polarisConfig, data),
      };
    }
  );

  consumeRPCQueue(
    'syncpolaris:sendLoanContract',
    async ({ data, subdomain }) => {
      const polarisConfig = await getConfig(subdomain, 'POLARIS', {});

      return {
        status: 'success',
        data: await createLoanMessage(subdomain, polarisConfig, data),
      };
    }
  );

  consumeRPCQueue(
    'syncpolaris:loanContractActive',
    async ({ data, subdomain }) => {
      const polarisConfig = await getConfig(subdomain, 'POLARIS', {});

      return {
        status: 'success',
        data: await activeLoan(subdomain, polarisConfig, data),
      };
    }
  );

  consumeRPCQueue(
    'syncpolaris:createLoanCollateral',
    async ({ data, subdomain }) => {
      const polarisConfig = await getConfig(subdomain, 'POLARIS', {});

      return {
        status: 'success',
        data: await createCollateral(subdomain, polarisConfig, data),
      };
    }
  );

  consumeRPCQueue('syncpolaris:find', async ({ data }) => {
    return {
      status: 'success',
      data: await Syncpolariss.find({}),
    };
  });

  consumeRPCQueue(
    'syncpolaris:getDepositBalance',
    async ({ data, subdomain }) => {
      const polarisConfig = await getConfig(subdomain, 'POLARIS', {});
      return {
        status: 'success',
        data: await getDepositBalance(subdomain, polarisConfig, data),
      };
    }
  );

  consumeRPCQueue('syncpolaris:sendDeposit', async ({ data, subdomain }) => {
    const polarisConfig = await getConfig(subdomain, 'POLARIS', {});

    return {
      status: 'success',
      data: await createDeposit(subdomain, polarisConfig, data),
    };
  });

  consumeRPCQueue(
    'syncpolaris:depositContractActive',
    async ({ data, subdomain }) => {
      const polarisConfig = await getConfig(subdomain, 'POLARIS', {});

      return {
        status: 'success',
        data: await activeDeposit(subdomain, polarisConfig, data),
      };
    }
  );

  consumeRPCQueue('syncpolaris:createSchedule', async ({ data, subdomain }) => {
    const polarisConfig = await getConfig(subdomain, 'POLARIS', {});
    return {
      status: 'success',
      data: await createLoanSchedule(subdomain, polarisConfig, data),
    };
  });

  consumeRPCQueue('syncpolaris:changeSchedule', async ({ data, subdomain }) => {
    const polarisConfig = await getConfig(subdomain, 'POLARIS', {});
    return {
      status: 'success',
      data: await changeLoanSchedule(subdomain, polarisConfig, data),
    };
  });

  consumeRPCQueue('syncpolaris:storeInterest', async ({ data, subdomain }) => {
    const polarisConfig = await getConfig(subdomain, 'POLARIS', {});
    return {
      status: 'success',
      data: await createLoanStoreInterest(subdomain, polarisConfig, data),
    };
  });
};

export const sendCommonMessage = async (
  args: MessageArgs & { serviceName: string }
) => {
  return sendMessage({
    ...args,
  });
};

export const sendCoreMessage = async (
  args: MessageArgsOmitService
): Promise<any> => {
  return sendMessage({
    serviceName: 'core',
    ...args,
  });
};
