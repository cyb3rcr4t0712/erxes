import resolvers from "..";
import { nanoid } from 'nanoid';
import { fixNum } from "@erxes/api-utils/src/core";
import {
  destroyBoardItemRelations,
  getCollection,
  getCompanyIds,
  getCustomerIds,
  getItem,
  getNewOrder,
} from "../../../models/utils";
import {
  IItemCommonFields,
  IItemDragCommonFields,
  IStageDocument,
} from "../../../models/definitions/boards";
import {
  BOARD_STATUSES,
} from "../../../models/definitions/constants";
import { IDeal, IDealDocument, IProductData } from "../../../models/definitions/deals";

import graphqlPubsub from "@erxes/api-utils/src/graphqlPubsub";
import {
  putActivityLog,
  putCreateLog,
  putDeleteLog,
  putUpdateLog,
} from "../../../logUtils";
import { can, checkUserIds } from "@erxes/api-utils/src";
import {
  copyChecklists,
  copyPipelineLabels,
  createConformity,
  IBoardNotificationParams,
  prepareBoardItemDoc,
  sendNotifications,
} from "../../utils";
import { IUserDocument } from "@erxes/api-utils/src/types";
import { generateModels, IModels } from "../../../connectionResolver";
import {
  sendCoreMessage,
  sendLoyaltiesMessage,
  sendNotificationsMessage,
  sendPricingMessage,
} from "../../../messageBroker";
import { debugError } from "@erxes/api-utils/src/debuggers";

export const itemResolver = async (
  models: IModels,
  subdomain: string,
  user: any,
  type: string,
  item: IItemCommonFields
) => {
  let resolverType = "";

  switch (type) {
    case "deal":
      resolverType = "Deal";
      break;
  }

  const additionInfo = {};
  const resolver = resolvers[resolverType] || {};

  for (const subResolver of Object.keys(resolver)) {
    try {
      additionInfo[subResolver] = await resolver[subResolver](
        item,
        {},
        { models, subdomain, user },
        { isSubscription: true }
      );
    } catch (unused) {
      continue;
    }
  }

  return additionInfo;
};

export const itemsAdd = async (
  models: IModels,
  subdomain: string,
  doc: (IDeal | IItemCommonFields) & {
    proccessId: string;
    aboveItemId: string;
  },
  type: string,
  createModel: any,
  user?: IUserDocument,
  docModifier?: any
) => {
  const { collection } = getCollection(models, type);

  doc.initialStageId = doc.stageId;
  doc.watchedUserIds = user && [user._id];

  const modifiedDoc = docModifier ? docModifier(doc) : doc;

  const extendedDoc = {
    ...modifiedDoc,
    modifiedBy: user && user._id,
    userId: user ? user._id : doc.userId,
    order: await getNewOrder({
      collection,
      stageId: doc.stageId,
      aboveItemId: doc.aboveItemId,
    }),
  };

  if (extendedDoc.customFieldsData) {
    // clean custom field values
    extendedDoc.customFieldsData = await sendCoreMessage({
      subdomain,
      action: "fields.prepareCustomFieldsData",
      data: extendedDoc.customFieldsData,
      isRPC: true,
      defaultValue: [],
    });
  }

  const item = await createModel(extendedDoc);
  const stage = await models.Stages.getStage(item.stageId);

  await createConformity(subdomain, {
    mainType: type,
    mainTypeId: item._id,
    companyIds: doc.companyIds,
    customerIds: doc.customerIds,
  });

  if (user) {
    const pipeline = await models.Pipelines.getPipeline(stage.pipelineId);

    sendNotifications(models, subdomain, {
      item,
      user,
      type: `${type}Add`,
      action: `invited you to the ${pipeline.name}`,
      content: `'${item.name}'.`,
      contentType: type,
    });

    await putCreateLog(
      models,
      subdomain,
      {
        type,
        newData: extendedDoc,
        object: item,
      },
      user
    );
  }

  graphqlPubsub.publish(`salesPipelinesChanged:${stage.pipelineId}`, {
    salesPipelinesChanged: {
      _id: stage.pipelineId,
      proccessId: doc.proccessId,
      action: "itemAdd",
      data: {
        item,
        aboveItemId: doc.aboveItemId,
        destinationStageId: stage._id,
      },
    },
  });

  return item;
};

export const changeItemStatus = async (
  models: IModels,
  subdomain: string,
  user: any,
  {
    type,
    item,
    status,
    proccessId,
    stage,
  }: {
    type: string;
    item: any;
    status: string;
    proccessId: string;
    stage: IStageDocument;
  }
) => {
  if (status === "archived") {
    graphqlPubsub.publish(`salesPipelinesChanged:${stage.pipelineId}`, {
      salesPipelinesChanged: {
        _id: stage.pipelineId,
        proccessId,
        action: "itemRemove",
        data: {
          item,
          oldStageId: item.stageId,
        },
      },
    });

    return;
  }

  const { collection } = getCollection(models, type);

  const aboveItems = await collection
    .find({
      stageId: item.stageId,
      status: { $ne: BOARD_STATUSES.ARCHIVED },
      order: { $lt: item.order },
    })
    .sort({ order: -1 })
    .limit(1);

  const aboveItemId = aboveItems[0]?._id || "";

  // maybe, recovered order includes to oldOrders
  await collection.updateOne(
    {
      _id: item._id,
    },
    {
      order: await getNewOrder({
        collection,
        stageId: item.stageId,
        aboveItemId,
      }),
    }
  );

  graphqlPubsub.publish(`salesPipelinesChanged:${stage.pipelineId}`, {
    salesPipelinesChanged: {
      _id: stage.pipelineId,
      proccessId,
      action: "itemAdd",
      data: {
        item: {
          ...item._doc,
          ...(await itemResolver(models, subdomain, user, type, item)),
        },
        aboveItemId,
        destinationStageId: item.stageId,
      },
    },
  });
};

export const itemsEdit = async (
  models: IModels,
  subdomain: string,
  _id: string,
  type: string,
  oldItem: any,
  doc: any,
  proccessId: string,
  user: IUserDocument,
  modelUpate
) => {
  const extendedDoc = {
    ...doc,
    modifiedAt: new Date(),
    modifiedBy: user._id,
  };

  const stage = await models.Stages.getStage(oldItem.stageId);

  const { canEditMemberIds } = stage;

  if (
    canEditMemberIds &&
    canEditMemberIds.length > 0 &&
    !canEditMemberIds.includes(user._id)
  ) {
    throw new Error("Permission denied");
  }

  if (
    doc.status === "archived" &&
    oldItem.status === "active" &&
    !(await can(subdomain, "dealsArchive", user))
  ) {
    throw new Error("Permission denied");
  }

  if (extendedDoc.customFieldsData) {
    // clean custom field values
    extendedDoc.customFieldsData = await sendCoreMessage({
      subdomain,
      action: "fields.prepareCustomFieldsData",
      data: extendedDoc.customFieldsData,
      isRPC: true,
    });
  }

  const updatedItem = await modelUpate(_id, extendedDoc);
  // labels should be copied to newly moved pipeline
  if (doc.stageId) {
    await copyPipelineLabels(models, { item: oldItem, doc, user });
  }

  const notificationDoc: IBoardNotificationParams = {
    item: updatedItem,
    user,
    type: `${type}Edit`,
    contentType: type,
  };

  if (doc.status && oldItem.status && oldItem.status !== doc.status) {
    const activityAction = doc.status === "active" ? "activated" : "archived";

    putActivityLog(subdomain, {
      action: "createArchiveLog",
      data: {
        item: updatedItem,
        contentType: type,
        action: "archive",
        userId: user._id,
        createdBy: user._id,
        contentId: updatedItem._id,
        content: activityAction,
      },
    });

    // order notification
    await changeItemStatus(models, subdomain, user, {
      type,
      item: updatedItem,
      status: activityAction,
      proccessId,
      stage,
    });
  }

  if (doc.assignedUserIds) {
    const { addedUserIds, removedUserIds } = checkUserIds(
      oldItem.assignedUserIds,
      doc.assignedUserIds
    );

    if (addedUserIds?.length || removedUserIds?.length) {
      const activityContent = { addedUserIds, removedUserIds };

      putActivityLog(subdomain, {
        action: "createAssigneLog",
        data: {
          contentId: _id,
          userId: user._id,
          contentType: type,
          content: activityContent,
          action: "assignee",
          createdBy: user._id,
        },
      });

      notificationDoc.invitedUsers = addedUserIds;
      notificationDoc.removedUsers = removedUserIds;
    }
  }

  await sendNotifications(models, subdomain, notificationDoc);

  if (!notificationDoc.invitedUsers && !notificationDoc.removedUsers) {
    sendCoreMessage({
      subdomain: "os",
      action: "sendMobileNotification",
      data: {
        title: notificationDoc?.item?.name,
        body: `${user?.details?.fullName || user?.details?.shortName
          } has updated`,
        receivers: notificationDoc?.item?.assignedUserIds,
        data: {
          type,
          id: _id,
        },
      },
    });
  }

  // exclude [null]
  if (doc.tagIds && doc.tagIds.length) {
    doc.tagIds = doc.tagIds.filter((ti) => ti);
  }

  putUpdateLog(
    models,
    subdomain,
    {
      type,
      object: oldItem,
      newData: extendedDoc,
      updatedDocument: updatedItem,
    },
    user
  );

  const updatedStage = await models.Stages.getStage(updatedItem.stageId);

  if (doc.tagIds || doc.startDate || doc.closeDate || doc.name) {
    graphqlPubsub.publish(`salesPipelinesChanged:${stage.pipelineId}`, {
      salesPipelinesChanged: {
        _id: stage.pipelineId,
      },
    });
  }

  if (updatedStage.pipelineId !== stage.pipelineId) {
    graphqlPubsub.publish(`salesPipelinesChanged:${stage.pipelineId}`, {
      salesPipelinesChanged: {
        _id: stage.pipelineId,
        proccessId,
        action: "itemRemove",
        data: {
          item: oldItem,
          oldStageId: stage._id,
        },
      },
    });
    graphqlPubsub.publish(`salesPipelinesChanged:${stage.pipelineId}`, {
      salesPipelinesChanged: {
        _id: updatedStage.pipelineId,
        proccessId,
        action: "itemAdd",
        data: {
          item: {
            ...updatedItem._doc,
            ...(await itemResolver(models, subdomain, user, type, updatedItem)),
          },
          aboveItemId: "",
          destinationStageId: updatedStage._id,
        },
      },
    });
  } else {
    graphqlPubsub.publish(`salesPipelinesChanged:${stage.pipelineId}`, {
      salesPipelinesChanged: {
        _id: stage.pipelineId,
        proccessId,
        action: "itemUpdate",
        data: {
          item: {
            ...updatedItem._doc,
            ...(await itemResolver(models, subdomain, user, type, updatedItem)),
          },
        },
      },
    });
  }
  await doScoreCampaign(subdomain, models, _id, updatedItem);

  if (oldItem.stageId === updatedItem.stageId) {
    return updatedItem;
  }

  // if task moves between stages
  const { content, action } = await itemMover(
    models,
    subdomain,
    user._id,
    oldItem,
    type,
    updatedItem.stageId
  );

  await sendNotifications(models, subdomain, {
    item: updatedItem,
    user,
    type: `${type}Change`,
    content,
    action,
    contentType: type,
  });

  return updatedItem;
};

const itemMover = async (
  models: IModels,
  subdomain: string,
  userId: string,
  item: IDealDocument,
  contentType: string,
  destinationStageId: string
) => {
  const oldStageId = item.stageId;

  let action = `changed order of your ${contentType}:`;
  let content = `'${item.name}'`;

  if (oldStageId !== destinationStageId) {
    const stage = await models.Stages.getStage(destinationStageId);
    const oldStage = await models.Stages.getStage(oldStageId);

    const pipeline = await models.Pipelines.getPipeline(stage.pipelineId);
    const oldPipeline = await models.Pipelines.getPipeline(oldStage.pipelineId);

    const board = await models.Boards.getBoard(pipeline.boardId);
    const oldBoard = await models.Boards.getBoard(oldPipeline.boardId);

    action = `moved '${item.name}' from ${oldBoard.name}-${oldPipeline.name}-${oldStage.name} to `;

    content = `${board.name}-${pipeline.name}-${stage.name}`;

    const link = `/${contentType}/board?id=${board._id}&pipelineId=${pipeline._id}&itemId=${item._id}`;

    const activityLogContent = {
      oldStageId,
      destinationStageId,
      text: `${oldStage.name} to ${stage.name}`,
    };

    await putActivityLog(subdomain, {
      action: "createBoardItemMovementLog",
      data: {
        item,
        contentType,
        userId,
        activityLogContent,
        link,
        action: "moved",
        contentId: item._id,
        createdBy: userId,
        content: activityLogContent,
      },
    });

    sendNotificationsMessage({
      subdomain,
      action: "batchUpdate",
      data: {
        selector: { contentType, contentTypeId: item._id },
        modifier: { $set: { link } },
      },
    });
  }

  return { content, action };
};

export const checkMovePermission = (
  stage: IStageDocument,
  user: IUserDocument
) => {
  if (
    stage.canMoveMemberIds &&
    stage.canMoveMemberIds.length > 0 &&
    !stage.canMoveMemberIds.includes(user._id)
  ) {
    throw new Error("Permission denied");
  }
};

export const itemsChange = async (
  models: IModels,
  subdomain: string,
  doc: IItemDragCommonFields,
  type: string,
  user: IUserDocument,
  modelUpdate: any
) => {
  const { collection } = getCollection(models, type);

  const { proccessId, itemId, aboveItemId, destinationStageId, sourceStageId } =
    doc;

  const item = await getItem(models, type, { _id: itemId });
  const stage = await models.Stages.getStage(item.stageId);

  const extendedDoc: IItemCommonFields = {
    modifiedAt: new Date(),
    modifiedBy: user._id,
    stageId: destinationStageId,
    order: await getNewOrder({
      collection,
      stageId: destinationStageId,
      aboveItemId,
    }),
  };

  if (item.stageId !== destinationStageId) {
    checkMovePermission(stage, user);

    const destinationStage = await models.Stages.getStage(destinationStageId);

    checkMovePermission(destinationStage, user);

    await doScoreCampaign(subdomain, models, itemId, {
      ...item.toObject(),
      ...extendedDoc,
    });

    extendedDoc.stageChangedDate = new Date();
  }

  const updatedItem = await modelUpdate(itemId, extendedDoc);

  const { content, action } = await itemMover(
    models,
    subdomain,
    user._id,
    item,
    type,
    destinationStageId
  );

  await sendNotifications(models, subdomain, {
    item,
    user,
    type: `${type}Change`,
    content,
    action,
    contentType: type,
  });

  if (item?.assignedUserIds && item?.assignedUserIds?.length > 0) {
    sendCoreMessage({
      subdomain: "os",
      action: "sendMobileNotification",
      data: {
        title: `${item.name}`,
        body: `${user?.details?.fullName || user?.details?.shortName} ${action + content}`,
        receivers: item?.assignedUserIds,
        data: {
          type,
          id: item._id,
        },
      },
    });
  }

  await putUpdateLog(
    models,
    subdomain,
    {
      type,
      object: item,
      newData: extendedDoc,
      updatedDocument: updatedItem,
    },
    user
  );

  // order notification
  const labels = await models.PipelineLabels.find({
    _id: {
      $in: item.labelIds,
    },
  });

  graphqlPubsub.publish(`salesPipelinesChanged:${stage.pipelineId}`, {
    salesPipelinesChanged: {
      _id: stage.pipelineId,
      proccessId,
      action: "orderUpdated",
      data: {
        item: {
          ...updatedItem._doc,
          ...(await itemResolver(models, subdomain, user, type, updatedItem)),
          labels,
        },
        aboveItemId,
        destinationStageId,
        oldStageId: sourceStageId,
      },
    },
  });

  return item;
};

export const itemsRemove = async (
  models: IModels,
  subdomain: string,
  _id: string,
  type: string,
  user: IUserDocument
) => {
  const item = await getItem(models, type, { _id });

  await sendNotifications(models, subdomain, {
    item,
    user,
    type: `${type}Delete`,
    action: `deleted ${type}:`,
    content: `'${item.name}'`,
    contentType: type,
  });

  if (item?.assignedUserIds && item?.assignedUserIds?.length > 0) {
    sendCoreMessage({
      subdomain: "os",
      action: "sendMobileNotification",
      data: {
        title: `${item.name}`,
        body: `${user?.details?.fullName || user?.details?.shortName} deleted the ${type}`,
        receivers: item?.assignedUserIds,
        data: {
          type,
          id: item._id,
        },
      },
    });
  }

  await destroyBoardItemRelations(models, subdomain, item._id, type);

  const removed = await getCollection(models, type).collection.findOneAndDelete(
    { _id: item._id }
  );

  await putDeleteLog(models, subdomain, { type, object: item }, user);

  return removed;
};

export const itemsCopy = async (
  models: IModels,
  subdomain: string,
  _id: string,
  proccessId: string,
  type: string,
  user: IUserDocument,
  extraDocParam: string[],
  modelCreate: any
) => {
  const { collection } = getCollection(models, type);
  const item = await collection.findOne({ _id }).lean();

  const doc = await prepareBoardItemDoc(item, collection, user._id);

  delete doc.sourceConversationIds;

  for (const param of extraDocParam) {
    doc[param] = item[param];
  }

  const clone = await modelCreate(doc);

  const companyIds = await getCompanyIds(subdomain, type, _id);
  const customerIds = await getCustomerIds(subdomain, type, _id);

  await createConformity(subdomain, {
    mainType: type,
    mainTypeId: clone._id,
    customerIds,
    companyIds,
  });

  await copyChecklists(models, {
    contentType: type,
    contentTypeId: item._id,
    targetContentId: clone._id,
    user,
  });

  // order notification
  const stage = await models.Stages.getStage(clone.stageId);

  graphqlPubsub.publish(`salesPipelinesChanged:${stage.pipelineId}`, {
    salesPipelinesChanged: {
      _id: stage.pipelineId,
      proccessId,
      action: "itemAdd",
      data: {
        item: {
          ...clone._doc,
          ...(await itemResolver(models, subdomain, user, type, clone)),
        },
        aboveItemId: _id,
        destinationStageId: stage._id,
      },
    },
  });

  await publishHelperItemsConformities(clone, stage);

  return clone;
};

export const itemsArchive = async (
  models: IModels,
  subdomain: string,
  stageId: string,
  type: string,
  proccessId: string,
  user: IUserDocument
) => {
  const { collection } = getCollection(models, type);

  const items = await collection
    .find({
      stageId,
      status: { $ne: BOARD_STATUSES.ARCHIVED },
    })
    .lean();

  await collection.updateMany(
    { stageId },
    { $set: { status: BOARD_STATUSES.ARCHIVED } }
  );

  // order notification
  const stage = await models.Stages.getStage(stageId);

  for (const item of items) {
    await putActivityLog(subdomain, {
      action: "createArchiveLog",
      data: {
        item,
        contentType: type,
        action: "archive",
        userId: user._id,
        createdBy: user._id,
        contentId: item._id,
        content: "archived",
      },
    });

    graphqlPubsub.publish(`salesPipelinesChanged:${stage.pipelineId}`, {
      salesPipelinesChanged: {
        _id: stage.pipelineId,
        proccessId,
        action: "itemsRemove",
        data: {
          item,
          destinationStageId: stage._id,
        },
      },
    });
  }

  return "ok";
};

export const publishHelperItemsConformities = async (
  item: IDealDocument,
  stage: IStageDocument
) => {
  graphqlPubsub.publish(`salesPipelinesChanged:${stage.pipelineId}`, {
    salesPipelinesChanged: {
      _id: stage.pipelineId,
      proccessId: Math.random().toString(),
      action: "itemOfConformitiesUpdate",
      data: {
        item: {
          ...item,
        },
      },
    },
  });
};

export const publishHelper = async (
  subdomain: string,
  type: string,
  itemId: string
) => {
  const models = await generateModels(subdomain);

  const item = await getItem(models, type, { _id: itemId });

  const stage = await models.Stages.getStage(item.stageId);
  await publishHelperItemsConformities(item, stage);
};

export const generateTotalAmount = (productsData) => {
  let totalAmount = 0;

  (productsData || []).forEach((product) => {
    if (product.tickUsed) {
      return;
    }

    totalAmount += product?.amount || 0;
  });

  return totalAmount;
};

export const doScoreCampaign = async (
  subdomain: string,
  models: IModels,
  _id: string,
  doc: IDeal
) => {
  if (!doc?.paymentsData) {
    return;
  }

  const types = Object.keys(doc.paymentsData);

  const stage = await models.Stages.findOne({ _id: doc.stageId });

  const pipeline = await models.Pipelines.findOne({
    _id: stage?.pipelineId,
    "paymentTypes.scoreCampaignId": { $exists: true },
    "paymentTypes.type": { $in: types },
  });

  const target: any = {
    paymentsData: Object.entries(doc.paymentsData).map(([type, obj]) => ({
      type,
      ...obj,
    })),
    totalAmount: generateTotalAmount(doc.productsData),
  };

  if (pipeline) {
    const [customerId] = (await getCustomerIds(subdomain, "deal", _id)) || [];

    if (customerId) {
      const scoreCampaignTypes = (pipeline?.paymentTypes || []).filter(
        ({ scoreCampaignId }) => !!scoreCampaignId
      );
      target.excludeAmount = Object.entries(doc.paymentsData)
        .filter(
          ([type]) => !scoreCampaignTypes.map(({ type }) => type).includes(type)
        )
        .map(([type, obj]) => ({
          type,
          ...obj,
        }))
        .reduce((sum, payment) => sum + (payment?.amount || 0), 0);
      for (const type of types) {
        const paymentType = scoreCampaignTypes.find(
          (paymentType) => paymentType.type === type
        );
        if (paymentType) {
          const { scoreCampaignId, title } = paymentType || {};
          if (!scoreCampaignId) {
            continue;
          }

          const scoreCampaign = await sendLoyaltiesMessage({
            subdomain,
            action: "scoreCampaign.findOne",
            data: { _id: scoreCampaignId },
            defaultValue: null,
            isRPC: true,
          });

          if (scoreCampaign) {
            const { additionalConfig = {} } = scoreCampaign || {};

            const stageIds = additionalConfig?.cardBasedRule?.flatMap(
              ({ stageIds }) => stageIds
            ) || [];

            if (stageIds.includes(doc.stageId)) {
              await sendLoyaltiesMessage({
                subdomain,
                action: "checkScoreAviableSubtract",
                data: {
                  ownerType: "customer",
                  ownerId: customerId,
                  campaignId: scoreCampaignId,
                  target,
                  targetId: _id,
                },
                isRPC: true,
                defaultValue: false,
              }).catch((error) => {
                if (error.message === "There has no enough score to subtract") {
                  throw new Error(
                    `There has no enough score to subtract using ${title}`
                  );
                }
                throw new Error(error.message);
              });
              await sendLoyaltiesMessage({
                subdomain,
                action: "doScoreCampaign",
                data: {
                  ownerType: "customer",
                  ownerId: customerId,
                  campaignId: scoreCampaignId,
                  target,
                  actionMethod: "subtract",
                  serviceName: "sales",
                  targetId: _id,
                },
                isRPC: true,
              }).catch((error) => {
                debugError(error);
                throw new Error(error.message);
              });
            }
          }
        }
      }
    }
  }
};

export const confirmLoyalties = async (
  subdomain: string,
  _id: string,
  deal: IDeal
) => {
  const confirmItems = deal.productsData || [];

  if (!confirmItems.length) {
    return;
  }

  const [customerId] = (await getCustomerIds(subdomain, "deal", _id)) || [];

  try {
    await sendLoyaltiesMessage({
      subdomain,
      action: "confirmLoyalties",
      data: {
        checkInfo: {},
        extraInfo: {
          ...(deal.extraData || {}),
          ownerType: "customer",
          ownerId: customerId || null,
          targetType: "sales",
          targetId: _id,
        },
      },
    });
  } catch (e) { }
};

export const checkPricing = async (
  subdomain: string,
  models: IModels,
  deal: IDeal
) => {
  let pricing: any = {};

  const activeProductsData = deal.productsData?.filter(
    pd => pd.tickUsed && !pd.bonusCount
  ) || [];

  if (!activeProductsData.length) {
    return deal.productsData;
  }

  const stage = await models.Stages.getStage(deal.stageId);

  try {
    const totalAmount = activeProductsData.reduce((sum, pd) => sum + (pd.amount || 0), 0)
    pricing = await sendPricingMessage({
      subdomain,
      action: 'checkPricing',
      data: {
        prioritizeRule: 'exclude',
        totalAmount,
        departmentId: deal.departmentIds?.length && deal.departmentIds[0] || '',
        branchId: deal.branchIds?.length && deal.branchIds[0] || '',
        pipelineId: stage.pipelineId,
        products: activeProductsData.map(i => ({
          itemId: i._id,
          productId: i.productId,
          quantity: i.quantity,
          price: i.unitPrice,
        }))
      },
      isRPC: true,
      defaultValue: {}
    });
  } catch (e) {
    console.log(e.message);
  }

  let bonusProductsToAdd: any = {};

  for (const item of activeProductsData || []) {
    const discount = pricing[item._id ?? ''];

    if (discount) {
      if (discount.bonusProducts.length !== 0) {
        for (const bonusProduct of discount.bonusProducts) {
          if (bonusProductsToAdd[bonusProduct]) {
            bonusProductsToAdd[bonusProduct].count += 1;
          } else {
            bonusProductsToAdd[bonusProduct] = {
              count: 1
            };
          }
        }
      }
      item.discountPercent = fixNum(discount.value * 100 / (item.unitPrice ?? 1), 8)
      item.discount = fixNum(discount.value * item.quantity);
      item.amount = fixNum((item.unitPrice - discount.value) * item.quantity);
    }
  }

  const addBonusPData: IProductData[] = [];

  for (const bonusProductId of Object.keys(bonusProductsToAdd)) {
    const bonusProduct: any = {
      _id: nanoid(),
      productId: bonusProductId,
      bonusCount: bonusProductsToAdd[bonusProductId].count,
      unitPrice: 0,
      quantity: bonusProductsToAdd[bonusProductId].count,
      amount: 0,
      tickUsed: true
    };

    addBonusPData.push(bonusProduct);
  }

  return [
    ...(deal.productsData || []).filter(pd => !pd.bonusCount).map(pd =>
      activeProductsData.find(apd => apd._id === pd._id) || pd
    ),
    ...addBonusPData
  ];
};

export const checkAssignedUserFromPData = (oldAllUserIds?: string[], assignedUsersPdata?: string[], oldPData?: IProductData[]) => {
  let assignedUserIds = oldAllUserIds || [];

  const oldAssignedUserPdata = (oldPData || [])
    .filter((pdata) => pdata.assignUserId)
    .map((pdata) => pdata.assignUserId || "");

  const { addedUserIds, removedUserIds } = checkUserIds(
    oldAssignedUserPdata,
    assignedUsersPdata
  );

  if (addedUserIds.length > 0 || removedUserIds.length > 0) {
    assignedUserIds = [...new Set(assignedUserIds.concat(addedUserIds))];
    assignedUserIds = assignedUserIds.filter(
      (userId) => !removedUserIds.includes(userId)
    );
  }

  return { assignedUserIds, addedUserIds, removedUserIds };
}
