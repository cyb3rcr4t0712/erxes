import {
  Button,
  ControlLabel,
  DateControl,
  Form,
  MainStyleFormColumn as FormColumn,
  FormControl,
  FormGroup,
  MainStyleFormWrapper as FormWrapper,
  MainStyleModalFooter as ModalFooter,
  MainStyleScrollWrapper as ScrollWrapper
} from "@erxes/ui/src";
import { IButtonMutateProps, IFormProps } from "@erxes/ui/src/types";
import { IContract, IContractDoc } from "../../types";
import { Tabs as MainTabs, TabTitle } from "@erxes/ui/src/components/tabs";
import SelectContractType, {
  ContractTypeById
} from "../../../contractTypes/containers/SelectContractType";

import ContractsCustomFields from "./ContractsCustomFields";
import { DateContainer } from "@erxes/ui/src/styles/main";
import { IContractType } from "../../../contractTypes/types";
import { IUser } from "@erxes/ui/src/auth/types";
import React from "react";
import SelectBranches from "@erxes/ui/src/team/containers/SelectBranches";
import SelectCompanies from "@erxes/ui-contacts/src/companies/containers/SelectCompanies";
import SelectContracts from "../common/SelectContract";
import SelectCustomers from "@erxes/ui-contacts/src/customers/containers/SelectCustomers";
import { __ } from "coreui/utils";

type Props = {
  currentUser: IUser;
  renderButton: (
    props: IButtonMutateProps & { disabled: boolean }
  ) => JSX.Element;
  contract: IContract;
  closeModal: () => void;
  change?: boolean;
};

type State = {
  contractTypeId: string;
  number: string;
  status: string;
  branchId: string;
  description: string;
  savingAmount: number;
  startDate: Date;
  duration: number;
  interestRate: number;
  closeInterestRate: number;
  storeInterestInterval: string;
  customerId: string;
  customerType: string;

  currency: string;
  config?: {
    maxAmount: number;
    minAmount: number;
    maxDuration: number;
    minDuration: number;
    maxInterest: number;
    minInterest: number;
  };
  interestGiveType: string;
  interestCalcType: string;
  closeOrExtendConfig: string;
  depositAccount?: string;
};

function isGreaterNumber(value: any, compareValue: any) {
  value = Number(value || 0);
  compareValue = Number(compareValue || 0);
  return value > compareValue;
}

interface ITabItem {
  component: any;
  label: string;
}

interface ITabs {
  tabs: ITabItem[];
}

export function Tabs({ tabs }: ITabs) {
  const [tabIndex, setTabIndex] = React.useState(0);

  return (
    <>
      <MainTabs>
        {tabs.map((tab, index) => (
          <TabTitle
            className={tabIndex === index ? "active" : ""}
            key={`tab${tab.label}`}
            onClick={() => setTabIndex(index)}
          >
            {tab.label}
          </TabTitle>
        ))}
      </MainTabs>

      <div style={{ width: "100%", marginTop: 20 }}>
        {tabs?.[tabIndex]?.component}
      </div>
    </>
  );
}

class ContractForm extends React.Component<Props, State> {
  constructor(props) {
    super(props);

    const { contract = {} } = props;

    this.state = {
      number: contract.number,
      status: contract.status,
      branchId: contract.branchId,
      description: contract.description,
      savingAmount: contract.savingAmount,
      startDate: contract.startDate,
      duration: contract.duration,
      interestRate: contract.interestRate,
      closeInterestRate: contract.closeInterestRate,
      contractTypeId: contract.contractTypeId,
      storeInterestInterval: contract.storeInterestInterval,
      customerId: contract.customerId,
      customerType: contract.customerType || "customer",
      currency:
        contract.currency || this.props.currentUser.configs?.dealCurrency?.[0],
      interestGiveType: contract.interestGiveType,
      closeOrExtendConfig: contract.closeOrExtendConfig,
      depositAccount: contract.depositAccount,
      interestCalcType: contract.interestCalcType
    };
  }

  generateDoc = (values: { _id: string } & IContractDoc) => {
    const { contract } = this.props;

    const finalValues = values;

    if (contract) {
      finalValues._id = contract._id;
    }

    const result = {
      _id: finalValues._id,
      ...this.state,
      contractTypeId: this.state.contractTypeId,
      branchId: this.state.branchId,
      status: this.state.status,
      description: this.state.description,
      createdBy: finalValues.createdBy,
      createdAt: finalValues.createdAt,
      savingAmount: Number(this.state.savingAmount),
      startDate: this.state.startDate,
      duration: Number(this.state.duration),
      interestRate: Number(this.state.interestRate),
      closeInterestRate: Number(this.state.closeInterestRate),
      storeInterestInterval: this.state.storeInterestInterval,
      interestCalcType: this.state.interestCalcType,
      customerId: this.state.customerId,
      customerType: this.state.customerType
    };

    return result;
  };

  renderFormGroup = (label, props) => {
    return (
      <FormGroup>
        <ControlLabel required={!label.includes("Amount")}>
          {__(label)}
        </ControlLabel>
        <FormControl {...props} />
      </FormGroup>
    );
  };

  onChangeField = (e) => {
    const name = (e.target as HTMLInputElement).name;
    const value = (e.target as HTMLInputElement).value;
    this.setState({ [name]: value } as any);
  };

  onSelectContractType = (value) => {
    const contractTypeObj: IContractType = ContractTypeById[value];

    var changingStateValue: any = { contractTypeId: value };

    //get default value from contract type
    changingStateValue["interestRate"] = Number(contractTypeObj?.interestRate);
    changingStateValue["closeInterestRate"] = Number(
      contractTypeObj?.closeInterestRate
    );
    changingStateValue["storeInterestInterval"] =
      contractTypeObj?.storeInterestInterval;
    changingStateValue["interestCalcType"] = contractTypeObj?.interestCalcType;
    changingStateValue["isAllowIncome"] = contractTypeObj?.isAllowIncome;
    changingStateValue["isAllowOutcome"] = contractTypeObj?.isAllowOutcome;
    changingStateValue["isDeposit"] = contractTypeObj?.isDeposit;

    if (!this.state.duration && contractTypeObj?.config?.minDuration) {
      changingStateValue["duration"] = contractTypeObj?.config?.minDuration;
    }

    this.setState({ ...changingStateValue });
  };

  onSelectCustomer = (value) => {
    this.setState({
      customerId: value
    });
  };

  onSelect = (value, key: string) => {
    this.setState({
      [key]: value
    } as any);
  };

  onCheckCustomerType = (e) => {
    this.setState({
      customerType: e.target.checked ? "company" : "customer"
    });
  };

  checkValidation = (): any => {
    const errors: any = {};

    function errorWrapper(text: string) {
      return <label style={{ color: "red" }}>{text}</label>;
    }

    if (
      this.state.config &&
      isGreaterNumber(this.state.interestRate, this.state.config.maxInterest)
    )
      errors.interestMonth = errorWrapper(
        `${__("Interest must less than")} ${this.state.config.maxInterest}`
      );

    return errors;
  };

  renderContent = (formProps: IFormProps) => {
    const { closeModal, renderButton, change } = this.props;
    const { values, isSubmitted } = formProps;

    const onChangeStartDate = (value) => {
      this.setState({ startDate: value });
    };

    const onChangeBranchId = (value) => {
      this.setState({ branchId: value });
    };

    return (
      <>
        <ScrollWrapper>
          <FormWrapper>
            {!change && (
              <FormColumn>
                <div style={{ paddingBottom: "13px", paddingTop: "20px" }}>
                  {this.renderFormGroup("Is Organization", {
                    ...formProps,
                    className: "flex-item",
                    type: "checkbox",
                    componentclass: "checkbox",
                    name: "customerType",
                    checked: this.state.customerType === "company",
                    onChange: this.onCheckCustomerType
                  })}
                </div>
                {this.state.customerType === "customer" && (
                  <FormGroup>
                    <ControlLabel required={true}>
                      {__("Customer")}
                    </ControlLabel>
                    <SelectCustomers
                      label="Choose customer"
                      name="customerId"
                      initialValue={this.state.customerId}
                      onSelect={this.onSelectCustomer}
                      multi={false}
                    />
                  </FormGroup>
                )}

                {this.state.customerType === "company" && (
                  <FormGroup>
                    <ControlLabel required={true}>{__("Company")}</ControlLabel>
                    <SelectCompanies
                      label="Choose company"
                      name="customerId"
                      initialValue={this.state.customerId}
                      onSelect={this.onSelectCustomer}
                      multi={false}
                    />
                  </FormGroup>
                )}
                <FormGroup>
                  <ControlLabel required={true}>
                    {__("Contract Type")}
                  </ControlLabel>
                  <SelectContractType
                    label={__("Choose type")}
                    name="contractTypeId"
                    value={this.state.contractTypeId || ""}
                    onSelect={this.onSelectContractType}
                    multi={false}
                  ></SelectContractType>
                </FormGroup>
              </FormColumn>
            )}
            {!change && (
              <FormColumn>
                <FormGroup>
                  <ControlLabel required={true}>
                    {__("Start Date")}
                  </ControlLabel>
                  <DateContainer>
                    <DateControl
                      {...formProps}
                      dateFormat="YYYY/MM/DD"
                      required={false}
                      name="startDate"
                      value={this.state.startDate}
                      onChange={onChangeStartDate}
                    />
                  </DateContainer>
                </FormGroup>
                {this.renderFormGroup("Duration", {
                  ...formProps,
                  className: "flex-item",
                  type: "number",
                  useNumberFormat: true,
                  name: "duration",
                  value: this.state.duration,
                  onChange: this.onChangeField
                })}
                {this.renderFormGroup("Saving Amount", {
                  ...formProps,
                  className: "flex-item",
                  type: "number",
                  useNumberFormat: true,
                  name: "savingAmount",
                  value: this.state.savingAmount,
                  onChange: this.onChangeField
                })}
              </FormColumn>
            )}
            <FormColumn>
              <FormGroup>
                <ControlLabel>{__("Branches")}</ControlLabel>
                <SelectBranches
                  name="branchId"
                  label={__("Choose branch")}
                  initialValue={this.state?.branchId}
                  onSelect={onChangeBranchId}
                  multi={false}
                />
              </FormGroup>
              {this.renderFormGroup("Interest Rate", {
                ...formProps,
                className: "flex-item",
                type: "number",
                useNumberFormat: true,
                name: "interestRate",
                value: this.state.interestRate,
                onChange: this.onChangeField
              })}

              <FormGroup>
                <ControlLabel required={true}>
                  {__("Close or extend of time")}
                </ControlLabel>
                <FormControl
                  {...this.props}
                  name="closeOrExtendConfig"
                  componentclass="select"
                  value={this.state.closeOrExtendConfig}
                  required={true}
                  onChange={this.onChangeField}
                >
                  {["closeEndOfContract", "autoExtend"].map(
                    (typeName, index) => (
                      <option key={index} value={typeName}>
                        {__(typeName)}
                      </option>
                    )
                  )}
                </FormControl>
              </FormGroup>
              <FormGroup>
                <ControlLabel required={true}>
                  {__("Interest give type")}
                </ControlLabel>
                <FormControl
                  {...this.props}
                  name="interestGiveType"
                  componentclass="select"
                  value={this.state.interestGiveType}
                  required={true}
                  onChange={this.onChangeField}
                >
                  {["currentAccount", "depositAccount"].map(
                    (typeName, index) => (
                      <option key={index} value={typeName}>
                        {__(typeName)}
                      </option>
                    )
                  )}
                </FormControl>
              </FormGroup>
              {this.state.interestGiveType === "depositAccount" && (
                <FormGroup>
                  <ControlLabel>{__("Deposit account")}</ControlLabel>
                  <SelectContracts
                    label={__("Choose an contract")}
                    name="depositAccount"
                    initialValue={this.state.depositAccount}
                    filterParams={{
                      isDeposit: true,
                      customerId: this.state.customerId
                    }}
                    onSelect={(v) => {
                      if (typeof v === "string") {
                        this.setState({
                          depositAccount: v
                        });
                      }
                    }}
                    multi={false}
                  />
                </FormGroup>
              )}
            </FormColumn>
          </FormWrapper>
          {!change && (
            <FormWrapper>
              <FormColumn>
                <FormGroup>
                  <ControlLabel>{__("Description")}</ControlLabel>
                  <FormControl
                    {...formProps}
                    max={140}
                    name="description"
                    componentclass="textarea"
                    value={this.state.description || ""}
                    onChange={this.onChangeField}
                  />
                </FormGroup>
              </FormColumn>
            </FormWrapper>
          )}
        </ScrollWrapper>

        <ModalFooter>
          <Button btnStyle="simple" onClick={closeModal} icon="cancel-1">
            {__("Close")}
          </Button>

          {renderButton({
            name: "contract",
            values: this.generateDoc(values),
            disabled: !!Object.keys(this.checkValidation()).length,
            isSubmitted,
            object: this.props.contract
          })}
        </ModalFooter>
      </>
    );
  };

  renderCustom = () => {
    return (
      <ContractsCustomFields
        isDetail={true}
        contract={{ ...this.props.contract, ...this.state } as any}
        collapseCallback={console.log}
      />
    );
  };

  render() {
    return (
      <Tabs
        tabs={[
          {
            label: "Гэрээ",
            component: <Form renderContent={this.renderContent} />
          },
          {
            label: "Бусад",
            component: <Form renderContent={this.renderCustom} />
          }
        ]}
      />
    );
  }
}

export default ContractForm;
