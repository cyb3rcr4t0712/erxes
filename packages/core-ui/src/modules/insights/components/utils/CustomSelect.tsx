import { Icon } from "@erxes/ui/src";
import React, { MouseEventHandler, useEffect, useState } from "react";
import Select, {
  components,
  MenuPlacement,
  MultiValueGenericProps,
  MultiValueProps,
  Props as SelectProps,
} from "react-select";
import {
  Checkbox,
  MultiValue,
  MultiValueContent,
  OptionLabel,
  ValueOption,
} from "../../styles";

type Props = {
  value: any;
  multi?: boolean;
  options: any[];
  fieldLabel: string;
  fieldValueOptions?: any[];
  onSelect: (option: any, value?: string) => void;
  onInputChange: (searchValue: string, actionMeta) => void;
  fieldName?: string;
  searchable?: boolean;
  refetch?: () => void;
};

const CustomSelect = (props: Props) => {
  const {
    value,
    multi,
    options,
    fieldLabel,
    fieldValueOptions,
    onSelect,
    onInputChange,
    fieldName,
    searchable,
    refetch,
  } = props;

  const [selectedOption, setSelectedOption] = useState();
  const [valueOptions, setValueOptions] = useState({});

  useEffect(() => {
    if (!selectedOption && value?.length) {
      setSelectedOption(value || []);
    }
  }, [value]);

  useEffect(() => {
    if (fieldValueOptions?.length && value) {
      setValueOptions((prevState) => {
        const optionValues = { ...prevState };

        value.forEach((option) => {
          const valueKey = option?.value;

          if (valueKey) {
            optionValues[valueKey] = { ...option };

            fieldValueOptions.forEach((fieldValueOption) => {
              optionValues[valueKey][fieldValueOption.fieldName] =
                option[fieldValueOption.fieldName] ||
                fieldValueOption.fieldDefaultValue;
            });
          }
        });

        Object.keys(optionValues).forEach((key) => {
          if (!value.find((opt) => opt.value === key)) {
            delete optionValues[key];
          }
        });

        return optionValues;
      });
    }
  }, [fieldValueOptions, value]);

  const handleValueOptionChange = (fieldName, fieldValue, fieldType) => {
    setValueOptions((prevOptions) => {
      let newOptions = { ...prevOptions };

      switch (fieldType) {
        case "checkbox":
          if (!newOptions[fieldValue]) {
            newOptions[fieldValue] = {};
          }
          newOptions[fieldValue][fieldName] =
            !newOptions[fieldValue][fieldName];
          break;

        default:
          return prevOptions;
      }

      setTimeout(() => {
        onSelect(Object.values(newOptions), "label");
      }, 0);

      return newOptions;
    });
  };

  const handleSelect = (selectedOption, actionMeta) => {
    if (fieldValueOptions?.length) {
      const selectedValues = (selectedOption || []).map((option) => {
        const options = valueOptions[option.value] || {};

        !Object.keys(options).length &&
          fieldValueOptions.map((fieldValueOption) => {
            const { fieldName, fieldDefaultValue } = fieldValueOption;

            options[fieldName] = fieldDefaultValue;
          });

        return { ...option, ...options };
      });

      if ((actionMeta.action === 'remove-value' || actionMeta.action === 'pop-value') && refetch) {
        refetch();
      }

      setSelectedOption(selectedValues);
      return onSelect(selectedValues, "label");
    }

    if ((actionMeta.action === 'remove-value' || actionMeta.action === 'pop-value') && refetch) {
      refetch();
    }

    setSelectedOption(selectedOption);
    onSelect(selectedOption);
  };

  const handleMenuOpen = () => {
    if (searchable && fieldName?.includes("Ids") && refetch) {
      refetch();
    }
  };

  const renderValueOption = (valueOption, fieldValue) => {
    const { fieldName, fieldType, fieldLabel, fieldDefaultValue } = valueOption;

    switch (fieldType) {
      case "checkbox":
        return (
          <ValueOption
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
          >
            <OptionLabel>
              <Checkbox
                className="squared-checkbox"
                checked={
                  valueOptions[fieldValue]?.[fieldName] || fieldDefaultValue
                }
                type="checkbox"
                name={fieldName}
                id={`${fieldValue}-${fieldName}`}
                onChange={() =>
                  handleValueOptionChange(fieldName, fieldValue, fieldType)
                }
              />
              <span>{fieldLabel}</span>
            </OptionLabel>
          </ValueOption>
        );
      default:
        break;
    }
  };

  const SortableMultiValueLabel = (props: MultiValueGenericProps<any>) => (
    <components.MultiValueLabel {...props} />
  );

  const CustomMultiValue = (props) => {
    const { data, removeProps, fieldValueOptions } = props;

    const onMouseDown: MouseEventHandler<HTMLDivElement> = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    return (
      <MultiValue onMouseDown={onMouseDown}>
        <MultiValueContent>
          <SortableMultiValueLabel {...props} />
          {fieldValueOptions?.map((fieldValueOption, index) =>
            renderValueOption(fieldValueOption, data.value)
          )}
        </MultiValueContent>
        <Icon icon="times" {...removeProps} />
      </MultiValue>
    );
  };

  const finalProps: SelectProps = {
    value: selectedOption,
    isMulti: multi,
    onChange: handleSelect,
    onInputChange: onInputChange,
    options: options,
    placeholder: fieldLabel,
    menuPlacement: "auto" as MenuPlacement,
    isClearable: true,
    onMenuOpen: handleMenuOpen,
  };

  if (fieldValueOptions?.length) {
    finalProps["components"] = {
      MultiValue: (props: MultiValueProps) => (
        <CustomMultiValue {...props} fieldValueOptions={fieldValueOptions} />
      ),
      MultiValueLabel: SortableMultiValueLabel,
    };
  }

  return <Select {...finalProps} />;
};

export default CustomSelect;
