import { getConstantFromStore } from "@erxes/ui/src/utils";

export const LEAD_CHOICES = [
  { label: "New", value: "new" },
  { label: "Contacted", value: "attemptedToContact" },
  { label: "Working", value: "inProgress" },
  { label: "Bad timing", value: "badTiming" },
  { label: "Unqualified", value: "unqualified" },
];

export const CUSTOMER_BASIC_INFO = {
  avatar: "Avatar",
  firstName: "First Name",
  lastName: "Last Name",
  middleName: "middleName",
  registrationNumber: "Registration Number",
  primaryEmail: "Primary E-mail",
  primaryPhone: "Primary Phone",
  position: "Position",
  department: "Department",
  hasAuthority: "Has Authority",
  description: "Description",
  isSubscribed: "Subscribed",
  birthDate: "birthDate",
  code: "code",
  score: "score",
  phoneValidationStatus: "phoneValidationStatus",

  ALL: [
    { field: "avatar", label: "Avatar" },
    { field: "firstName", label: "First Name" },
    { field: "middleName", label: "Middle Name" },
    { field: "registrationNumber", label: "Registration Number" },
    { field: "lastName", label: "Last Name" },
    { field: "primaryEmail", label: "Primary E-mail" },
    { field: "primaryPhone", label: "Primary Phone" },
    { field: "position", label: "Position" },
    { field: "department", label: "Department" },
    { field: "hasAuthority", label: "Has Authority" },
    { field: "description", label: "Description" },
    { field: "isSubscribed", label: "Subscribed" },
    { field: "birthDate", label: "Birthday" },
    { field: "code", label: "Code" },
    { field: "score", label: "Score" },
    { field: "phoneValidationStatus", label: "PhoneValidationStatus" },
  ],
};

export const CUSTOMER_DATAS = {
  visitorContactInfo: "Visitor contact info",
  owner: "Owner",
  links: "Links",

  ALL: [
    { field: "visitorContactInfo", label: "Visitor contact info" },
    { field: "owner", label: "Owner" },
    { field: "links", label: "Links" },
  ],
};

export const CUSTOMER_LINKS = {
  linkedIn: "LinkedIn",
  twitter: "Twitter",
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "Youtube",
  github: "Github",
  website: "Website",

  ALL: [
    { field: "linkedIn", label: "LinkedIn" },
    { field: "twitter", label: "Twitter" },
    { field: "facebook", label: "Facebook" },
    { field: "instagram", label: "Instagram" },
    { field: "youtube", label: "Youtube" },
    { field: "github", label: "Github" },
    { field: "website", label: "Website" },
  ],
};

export const LEAD_STATUS_TYPES = {
  new: "New",
  attemptedToContact: "Contacted",
  inProgress: "Working",
  badTiming: "Bad Timing",
  unqualified: "Unqualified",
};

export const GENDER_TYPES = () => getConstantFromStore("sex_choices", true);

export const EMAIL_VALIDATION_STATUSES = [
  { label: "Valid", value: "valid" },
  { label: "Invalid", value: "invalid" },
  { label: "Accept all unverifiable", value: "accept_all_unverifiable" },
  { label: "Unknown", value: "unknown" },
  { label: "Disposable", value: "disposable" },
  { label: "Catchall", value: "catchall" },
  { label: "Bad syntax", value: "badsyntax" },
  { label: "Unverifiable", value: "unverifiable" },
  { label: "Not checked", value: "Not checked" },
];

export const PHONE_VALIDATION_STATUSES = [
  { label: "Valid", value: "valid" },
  { label: "Invalid", value: "invalid" },
  { label: "Unknown", value: "unknown" },
  { label: "Unverifiable", value: "unverifiable" },
  { label: "Mobile phone", value: "receives_sms" },
];

export const CUSTOMER_STATE_OPTIONS = [
  { label: "Customer", value: "customer" },
  { label: "Lead", value: "lead" },
];
