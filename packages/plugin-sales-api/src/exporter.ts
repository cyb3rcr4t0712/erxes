import { generateModels, IModels } from "./connectionResolver";
import { IMPORT_EXPORT_TYPES, MODULE_NAMES } from "./constants";
import { fetchSegment, sendCoreMessage } from "./messageBroker";
import * as moment from "moment";
import { IUserDocument } from "@erxes/api-utils/src/types";
import { IPipelineLabelDocument } from "./models/definitions/pipelineLabels";
import { IStageDocument } from "./models/definitions/boards";
import {
  getCompanyIds,
  getCustomerIds,
  getInternalNoteIds
} from "./models/utils";

const prepareData = async (
  models: IModels,
  subdomain: string,
  query: any
): Promise<any[]> => {
  const { contentType, segmentData, page, perPage } = query;

  let data: any[] = [];

  const type = contentType.split(":")[1];
  const skip = (page - 1) * perPage;

  const boardItemsFilter: any = {};
  let itemIds = [];

  if (segmentData && segmentData.conditions) {
    itemIds = await fetchSegment(subdomain, "", { page, perPage }, segmentData);

    boardItemsFilter._id = { $in: itemIds };
  }

  switch (type) {
    case MODULE_NAMES.DEAL:
      if (!segmentData) {
        data = await models.Deals.find(boardItemsFilter)
          .skip(skip)
          .limit(perPage)
          .lean();
      } else {
        data = await models.Deals.find(boardItemsFilter).lean();
      }

      break;
  }

  return data;
};

const prepareDataCount = async (
  models: IModels,
  subdomain: string,
  query: any
): Promise<any> => {
  const { contentType, segmentData } = query;

  const type = contentType.split(":")[1];

  let data = 0;

  const boardItemsFilter: any = {};

  if (segmentData && segmentData.conditions) {
    const itemIds = await fetchSegment(
      subdomain,
      "",
      { scroll: true, page: 1, perPage: 10000 },
      segmentData
    );

    boardItemsFilter._id = { $in: itemIds };
  }

  switch (type) {
    case MODULE_NAMES.DEAL:
      data = await models.Deals.find(boardItemsFilter).countDocuments();

      break;
  }

  return data;
};

const getCustomFieldsData = async (item, fieldId) => {
  let value;

  if (item.customFieldsData && item.customFieldsData.length > 0) {
    for (const customFeild of item.customFieldsData) {
      if (customFeild.field === fieldId) {
        value = customFeild.value;

        if (Array.isArray(value)) {
          value = value.join(", ");
        }

        return { value };
      }
    }
  }

  return { value };
};

const fillDealProductValue = async (subdomain, column, item) => {
  const productsData = item.productsData;

  const productDocs: any[] = [];

  for (const productData of productsData) {
    let product;
    let value;
    const result = {};

    switch (column) {
      case "productsData.amount":
        value = productData.amount;
        break;

      case "productsData.name":
        product =
          (await sendCoreMessage({
            subdomain,
            action: "products.findOne",
            data: {
              _id: productData.productId
            },
            isRPC: true
          })) || {};

        value = product.name;
        break;

      case "productsData.code":
        product =
          (await sendCoreMessage({
            subdomain,
            action: "products.findOne",
            data: {
              _id: productData.productId
            },
            isRPC: true
          })) || {};

        value = product.code;
        break;

      case "productsData.discount":
        value = productData.discount;
        break;

      case "productsData.discountPercent":
        value = productData.discountPercent;
        break;

      case "productsData.currency":
        value = productData.amount;
        break;

      case "productsData.tax":
        value = productData.tax;
        break;

      case "productsData.taxPercent":
        value = productData.taxPercent;
        break;

      case "productsData.quantity":
        value = productData.quantity;
        break;

      case "productsData.unitPrice":
        value = productData.unitPrice;
        break;

      case "productsData.tickUsed":
        value = productData.tickUsed ? "TRUE" : "FALSE";
        break;

      case "productsData.isVatApplied":
        value = productData.isVatApplied;
        break;

      case "productsData.branch":
        const branch =
          (await sendCoreMessage({
            subdomain,
            action: "branches.findOne",
            data: {
              _id: productData.branchId
            },
            isRPC: true
          })) || {};

        value = branch.code;
        break;

      case "productsData.department":
        const department =
          (await sendCoreMessage({
            subdomain,
            action: "departments.findOne",
            data: {
              _id: productData.departmentId
            },
            isRPC: true
          })) || {};

        value = department.code;
        break;

      case "productsData.maxQuantity":
        value = productData.maxQuantity;
        break;
    }

    result[column] = value;

    productDocs.push(result);
  }

  return productDocs;
};

const fillValue = async (
  models: IModels,
  subdomain: string,
  column: string,
  item: any,
  contentType: string
): Promise<string> => {
  let value = item[column];
  const type = contentType.split(":")[1];

  switch (column) {
    case "createdAt":
    case "closeDate":
    case "modifiedAt":
      value = moment(value).format("YYYY-MM-DD");

      break;
    case "userId":
      const createdUser: IUserDocument | null = await sendCoreMessage({
        subdomain,
        action: "users.findOne",
        data: {
          _id: item.userId
        },
        isRPC: true
      });

      value = createdUser ? createdUser.username : "user not found";

      break;
    // deal fields
    case "assignedUserIds":
      const assignedUsers: IUserDocument[] = await sendCoreMessage({
        subdomain,
        action: "users.find",
        data: {
          query: {
            _id: { $in: item.assignedUserIds || [] }
          }
        },
        isRPC: true,
        defaultValue: []
      });

      value = assignedUsers.map(user => user.username || user.email).join(", ");

      break;

    case "watchedUserIds":
      const watchedUsers: IUserDocument[] = await sendCoreMessage({
        subdomain,
        action: "users.find",
        data: {
          query: {
            _id: { $in: item.watchedUserIds || [] }
          }
        },
        isRPC: true,
        defaultValue: []
      });

      value = watchedUsers.map(user => user.username || user.email).join(", ");

      break;

    case "labelIds":
      const labels: IPipelineLabelDocument[] = await models.PipelineLabels.find(
        {
          _id: { $in: item.labelIds }
        }
      );

      value = labels.map(label => label.name).join(", ");

      break;

    case "branchIds":
      const branches = await sendCoreMessage({
        subdomain,
        action: `branches.find`,
        data: {
          query: { _id: { $in: item.branchIds || [] } }
        },
        isRPC: true,
        defaultValue: []
      });

      value = branches.map(branch => branch.title).join(", ");

      break;

    case "departmentIds":
      const departments = await sendCoreMessage({
        subdomain,
        action: "departments.find",
        data: {
          _id: { $in: item.departmentIds || [] }
        },
        isRPC: true,
        defaultValue: []
      });

      value = departments.map(department => department.title).join(", ");

      break;

    case "stageId":
      const stage: IStageDocument | null = await models.Stages.findOne({
        _id: item.stageId
      });

      value = stage ? stage.name : "-";

      break;

    case "boardId":
      const stageForBoard = await models.Stages.findOne({
        _id: item.stageId
      });

      value = "-";

      if (stageForBoard) {
        const pipeline = await models.Pipelines.findOne({
          _id: stageForBoard.pipelineId
        });

        if (pipeline) {
          const board = await models.Boards.findOne({ _id: pipeline.boardId });

          value = board ? board.name : "-";
        }
      }

      break;

    case "pipelineId":
      const stageForPipeline = await models.Stages.findOne({
        _id: item.stageId
      });

      value = "-";

      if (stageForPipeline) {
        const pipeline = await models.Pipelines.findOne({
          _id: stageForPipeline.pipelineId
        });

        value = pipeline ? pipeline.name : "-";
      }

      break;

    case "initialStageId":
      const initialStage: IStageDocument | null = await models.Stages.findOne({
        _id: item.initialStageId
      });

      value = initialStage ? initialStage.name : "-";

      break;

    case "modifiedBy":
      const modifiedBy: IUserDocument | null = await sendCoreMessage({
        subdomain,
        action: "users.findOne",
        data: {
          _id: item.modifiedBy
        },
        isRPC: true
      });

      value = modifiedBy ? modifiedBy.username : "-";

      break;

    case "totalAmount":
      const productDatas = item.productsData;
      let totalAmount = 0;

      if (productDatas) {
        for (const data of productDatas) {
          if (data.amount) {
            totalAmount = totalAmount + data.amount;
          }
        }
      }

      value = totalAmount ? totalAmount : "-";

      break;

    case "totalLabelCount":
      value = item.labelIds ? item.labelIds.length : "-";

      break;

    case "stageMovedUser":
      const activities = await sendCoreMessage({
        subdomain,
        action: "activityLogs.findMany",
        data: {
          query: {
            contentId: item._id,
            action: "moved"
          }
        },
        isRPC: true,
        defaultValue: []
      });

      const movedUser: IUserDocument | null = await sendCoreMessage({
        subdomain,
        action: "users.findOne",
        data: {
          _id:
            activities.length > 0
              ? activities[activities.length - 1].createdBy
              : ""
        },
        isRPC: true
      });

      value = movedUser ? movedUser.username : "-";

      break;

    case "customersEmail": {
      const customerIds = await getCustomerIds(subdomain, type, item._id);
      const customerRows: any[] = [];


      for (const id of customerIds) {
        const customer = await sendCoreMessage({
          subdomain,
          action: "customers.findOne",
          data: { _id: id },
          isRPC: true,
          defaultValue: ""
        });

        customerRows.push(customer);
      }

      value = customerRows
        .map(customer => customer.primaryEmail || "")
        .join(", ");
      
      break;
    }

    case "customersName": {
      const customerIds = await getCustomerIds(subdomain, type, item._id);
      const customerRows: any[] = [];


      for (const id of customerIds) {
        const customer = await sendCoreMessage({
          subdomain,
          action: "customers.findOne",
          data: { _id: id },
          isRPC: true,
          defaultValue: ""
        });

        customerRows.push(customer);
      }

      value = customerRows
        .map(customer => {
          const first = customer.firstName.trim();
          const middle = customer.middleName?.trim();
          const last = customer.lastName.trim();

          if (!first && !middle && !last) return "Unnamed Customer"

          const nameParts = [first,",",middle,last]
            .filter(part => part && part !== ",")
            .join(" ")
            .replace(/\s+,/g, ",");
          return nameParts;
        })
        .join(", ") 

      }
      break;

    case "customersPhone":{
      const customerIds = await getCustomerIds(subdomain, type, item._id);
      const customerRows: any[] = [];


      for (const id of customerIds) {
        const customer = await sendCoreMessage({
          subdomain,
          action: "customers.findOne",
          data: { _id: id },
          isRPC: true,
          defaultValue: {}
        });

        customerRows.push(customer);
      }

      value = customerRows
        .map(customer => {
             return customer.primaryPhone || 
             (customer.phones && customer.phones.length ? customer.phones[0] : '');
        })
        .join(", ")
    }
    break;


    case "companies":
      const companyRows = [] as any;

      const companyIds = await getCompanyIds(subdomain, type, item._id);

      for (const id of companyIds) {
        const company = await sendCoreMessage({
          subdomain,
          action: "companies.findOne",
          data: { _id: id },
          isRPC: true,
          defaultValue: ""
        });

        companyRows.push(company);
      }

      value = companyRows.map(company => company.primaryName || "").join(", ");
      break;

    case "internalNotes":
      const notes = await getInternalNoteIds(subdomain, contentType, item._id);

      const removeTag = text => {
        return text.replace(/<\/?[^>]+(>|$)|&nbsp;/g, "");
      };

      value = notes
        .map((note: any) => removeTag(note.content) || "")
        .join(", ");

      break;

    default:
      break;
  }

  return value || "-";
};

export default {
  importExportTypes: IMPORT_EXPORT_TYPES,

  prepareExportData: async ({ subdomain, data }) => {
    const models = await generateModels(subdomain);

    const { columnsConfig } = data;

    let totalCount = 0;
    const headers = [] as any;
    const excelHeader = [] as any;

    try {
      const results = await prepareDataCount(models, subdomain, data);

      totalCount = results;

      for (const column of columnsConfig) {
        if (column.startsWith("customFieldsData")) {
          const fieldId = column.split(".")[1];
          const field = await sendCoreMessage({
            subdomain,
            action: "fields.findOne",
            data: {
              query: {
                _id: fieldId
              }
            },
            isRPC: true
          });

          headers.push(`customFieldsData.${field.text}.${fieldId}`);
        } else if (column.startsWith("productsData")) {
          headers.push(column);
        } else {
          headers.push(column);
        }
      }

      for (const header of headers) {
        if (header.startsWith("customFieldsData")) {
          excelHeader.push(header.split(".")[1]);
        } else {
          excelHeader.push(header);
        }
      }
    } catch (e) {
      return {
        error: e.message
      };
    }
    return { totalCount, excelHeader };
  },

  getExportDocs: async ({ subdomain, data }) => {
    const models = await generateModels(subdomain);


    const { columnsConfig } = data;

    const docs = [] as any;
    const headers = [] as any;

    try {
      const results = await prepareData(models, subdomain, data);

      for (const column of columnsConfig) {
        if (column.startsWith("customFieldsData")) {
          const fieldId = column.split(".")[1];
          const field = await sendCoreMessage({
            subdomain,
            action: "fields.findOne",
            data: {
              query: { _id: fieldId }
            },
            isRPC: true
          });

          headers.push(`customFieldsData.${field.text}.${fieldId}`);
        } else if (column.startsWith("productsData")) {
          headers.push(column);
        } else {
          headers.push(column);
        }
      }

      for (const item of results) {
        const result = {};
        const productDocs = [] as any;
        const productsArray = [] as any;

        for (const column of headers) {
          if (column.startsWith("customFieldsData")) {
            const fieldId = column.split(".")[2];
            const fieldName = column.split(".")[1];

            const { value } = await getCustomFieldsData(item, fieldId);

            result[fieldName] = value || "-";
          } else if (column.startsWith("productsData")) {
            const productItem = await fillDealProductValue(
              subdomain,
              column,
              item
            );

            productDocs.push(productItem);
          } else {
            const value = await fillValue(
              models,
              subdomain,
              column,
              item,
              data.contentType
            );

            result[column] = value || "-";
          }
        }

        if (productDocs.length > 0) {
          for (let i = 0; i < productDocs.length; i++) {
            const sortedItem = [] as any;

            for (const productDoc of productDocs) {
              if (productDoc[i]) {
                sortedItem.push(productDoc[i]);
              }
            }

            if (sortedItem.length) {
              productsArray.push(sortedItem);
            }
          }
        }

        if (productsArray.length > 0) {
          let index = 0;

          for (const productElement of productsArray) {
            const mergedObject = Object.assign({}, ...productElement);
            if (index === 0) {
              docs.push({
                ...result,
                ...mergedObject
              });
              index++;
            } else {
              docs.push(mergedObject);
            }
          }
        } else {
          docs.push(result);
        }
      }
    } catch (e) {
      return { error: e.message };
    }

    return { docs };
  }
};
