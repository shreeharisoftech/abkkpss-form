import {
  AcDataDictionary,
  AcDDTable,
  AcDDTableColumn,
  AcDDTableColumnProperty,
  AcEnumDDColumnProperty,
  AcEnumDDColumnType,
} from 'ac-data-dictionary';
import { AcEnumSqlDatabaseType } from '@autocode-ts/autocode';

export const DATA_DICTIONARY_NAME = 'abkkpss';

export enum UserRole {
  REGULAR_USER = 'REGULAR_USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum FormStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface UserRow {
  id?: number;
  username: string;
  password_hash: string;
  role: UserRole;
  zone_id?: string | null;
  created_at?: string;
}

export interface FormRow {
  id?: number;
  zone_number: string;
  family_number: string;
  // Residential Address Fields
  address_line_1: string;
  address_line_2?: string;
  city_name: string;
  state_name: string;
  country_name: string;
  pincode: string;
  current_city_or_place?: string;
  residential_address?: string;

  // Firm Details Fields
  firm_name?: string;
  firm_address_line_1?: string;
  firm_address_line_2?: string;
  firm_city_name?: string;
  firm_state_name?: string;
  firm_country_name?: string;
  firm_postal_code?: string;
  firm_address?: string;

  // Native Details (village removed)
  native_place: string;
  surname: string;
  gotra: string;
  taluka: string;
  district: string;

  // Filler & Payment
  filler_name: string;
  filler_mobile: string;
  total_adults_count: number;
  total_amount: number;
  payment_mode: string;
  receipt_number?: string | null;
  status: FormStatus;
  created_by: number;
  approved_by?: number | null;
  created_at?: string;
}

export interface MemberRow {
  id?: number;
  form_id: number;
  serial_no: number;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  name: string;
  dob: string;
  is_adult_18_plus: boolean | number;
  gender: 'M' | 'F';
  relation: string;
  education: string;
  mobile_number: string;
  blood_group: string;
  is_main_member?: boolean | number;
  unique_member_seq?: number | null;
  fixed_member_number?: string | null;
}

function buildColumn({
  columnName,
  columnType,
  isPrimaryKey = false,
  isUnique = false,
  isNotNull = false,
  defaultValue = null,
}: {
  columnName: string;
  columnType: AcEnumDDColumnType;
  isPrimaryKey?: boolean;
  isUnique?: boolean;
  isNotNull?: boolean;
  defaultValue?: any;
}): AcDDTableColumn {
  const col = new AcDDTableColumn();
  col.columnName = columnName;
  col.columnType = columnType;

  if (isPrimaryKey) {
    const prop = new AcDDTableColumnProperty();
    prop.propertyName = AcEnumDDColumnProperty.PrimaryKey;
    prop.propertyValue = true;
    col.columnProperties[AcEnumDDColumnProperty.PrimaryKey] = prop;
  }
  if (isUnique) {
    const prop = new AcDDTableColumnProperty();
    prop.propertyName = AcEnumDDColumnProperty.UniqueKey;
    prop.propertyValue = true;
    col.columnProperties[AcEnumDDColumnProperty.UniqueKey] = prop;
  }
  if (isNotNull) {
    const prop = new AcDDTableColumnProperty();
    prop.propertyName = AcEnumDDColumnProperty.NotNull;
    prop.propertyValue = true;
    col.columnProperties[AcEnumDDColumnProperty.NotNull] = prop;
  }
  if (defaultValue !== null) {
    const prop = new AcDDTableColumnProperty();
    prop.propertyName = AcEnumDDColumnProperty.DefaultValue;
    prop.propertyValue = defaultValue;
    col.columnProperties[AcEnumDDColumnProperty.DefaultValue] = prop;
  }

  return col;
}

function serializeTableForDD(table: AcDDTable): Record<string, any> {
  const json = table.toJson();
  const columnsMap: Record<string, any> = {};
  for (const col of table.tableColumns) {
    columnsMap[col.columnName] = col.toJson();
  }
  json.tableColumns = columnsMap;
  json.tableProperties = {};
  return json;
}

export function defineAbkkpssDataDictionary(): AcDataDictionary {
  const usersTable = schemaDefinitions.users();
  const formsTable = schemaDefinitions.forms();
  const membersTable = schemaDefinitions.members();

  const ddJson = {
    version: 1,
    tables: {
      users: serializeTableForDD(usersTable),
      forms: serializeTableForDD(formsTable),
      members: serializeTableForDD(membersTable),
    },
  };

  AcDataDictionary.registerDataDictionary({ jsonData: ddJson, dataDictionaryName: DATA_DICTIONARY_NAME });
  AcDataDictionary.registerDataDictionary({ jsonData: ddJson, dataDictionaryName: 'default' });

  return AcDataDictionary.getInstance({ dataDictionaryName: DATA_DICTIONARY_NAME });
}

export const schemaDefinitions = {
  users: () => {
    const t = new AcDDTable();
    t.tableName = 'users';
    t.tableColumns = [
      buildColumn({ columnName: 'id', columnType: AcEnumDDColumnType.AutoIncrement, isPrimaryKey: true }),
      buildColumn({ columnName: 'username', columnType: AcEnumDDColumnType.String, isUnique: true, isNotNull: true }),
      buildColumn({ columnName: 'password_hash', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'role', columnType: AcEnumDDColumnType.String, isNotNull: true, defaultValue: UserRole.REGULAR_USER }),
      buildColumn({ columnName: 'zone_id', columnType: AcEnumDDColumnType.String }),
      buildColumn({ columnName: 'created_at', columnType: AcEnumDDColumnType.String, isNotNull: true }),
    ];
    return t;
  },
  forms: () => {
    const t = new AcDDTable();
    t.tableName = 'forms';
    t.tableColumns = [
      buildColumn({ columnName: 'id', columnType: AcEnumDDColumnType.AutoIncrement, isPrimaryKey: true }),
      buildColumn({ columnName: 'zone_number', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'family_number', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'address_line_1', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'address_line_2', columnType: AcEnumDDColumnType.String }),
      buildColumn({ columnName: 'city_name', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'state_name', columnType: AcEnumDDColumnType.String, isNotNull: true, defaultValue: 'Gujarat' }),
      buildColumn({ columnName: 'country_name', columnType: AcEnumDDColumnType.String, isNotNull: true, defaultValue: 'India' }),
      buildColumn({ columnName: 'pincode', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'current_city_or_place', columnType: AcEnumDDColumnType.String }),
      buildColumn({ columnName: 'residential_address', columnType: AcEnumDDColumnType.Text }),
      buildColumn({ columnName: 'firm_name', columnType: AcEnumDDColumnType.String }),
      buildColumn({ columnName: 'firm_address_line_1', columnType: AcEnumDDColumnType.String }),
      buildColumn({ columnName: 'firm_address_line_2', columnType: AcEnumDDColumnType.String }),
      buildColumn({ columnName: 'firm_city_name', columnType: AcEnumDDColumnType.String }),
      buildColumn({ columnName: 'firm_state_name', columnType: AcEnumDDColumnType.String }),
      buildColumn({ columnName: 'firm_country_name', columnType: AcEnumDDColumnType.String }),
      buildColumn({ columnName: 'firm_postal_code', columnType: AcEnumDDColumnType.String }),
      buildColumn({ columnName: 'firm_address', columnType: AcEnumDDColumnType.Text }),
      buildColumn({ columnName: 'native_place', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'surname', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'gotra', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'taluka', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'district', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'filler_name', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'filler_mobile', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'total_adults_count', columnType: AcEnumDDColumnType.Integer, isNotNull: true, defaultValue: 0 }),
      buildColumn({ columnName: 'total_amount', columnType: AcEnumDDColumnType.Double, isNotNull: true, defaultValue: 0 }),
      buildColumn({ columnName: 'payment_mode', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'receipt_number', columnType: AcEnumDDColumnType.String }),
      buildColumn({ columnName: 'status', columnType: AcEnumDDColumnType.String, isNotNull: true, defaultValue: FormStatus.PENDING }),
      buildColumn({ columnName: 'created_by', columnType: AcEnumDDColumnType.Integer, isNotNull: true }),
      buildColumn({ columnName: 'approved_by', columnType: AcEnumDDColumnType.Integer }),
      buildColumn({ columnName: 'created_at', columnType: AcEnumDDColumnType.String, isNotNull: true }),
    ];
    return t;
  },
  members: () => {
    const t = new AcDDTable();
    t.tableName = 'members';
    t.tableColumns = [
      buildColumn({ columnName: 'id', columnType: AcEnumDDColumnType.AutoIncrement, isPrimaryKey: true }),
      buildColumn({ columnName: 'form_id', columnType: AcEnumDDColumnType.Integer, isNotNull: true }),
      buildColumn({ columnName: 'serial_no', columnType: AcEnumDDColumnType.Integer, isNotNull: true }),
      buildColumn({ columnName: 'first_name', columnType: AcEnumDDColumnType.String }),
      buildColumn({ columnName: 'middle_name', columnType: AcEnumDDColumnType.String }),
      buildColumn({ columnName: 'last_name', columnType: AcEnumDDColumnType.String }),
      buildColumn({ columnName: 'name', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'dob', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'is_adult_18_plus', columnType: AcEnumDDColumnType.Integer, isNotNull: true, defaultValue: 0 }),
      buildColumn({ columnName: 'gender', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'relation', columnType: AcEnumDDColumnType.String, isNotNull: true }),
      buildColumn({ columnName: 'education', columnType: AcEnumDDColumnType.String }),
      buildColumn({ columnName: 'mobile_number', columnType: AcEnumDDColumnType.String }),
      buildColumn({ columnName: 'blood_group', columnType: AcEnumDDColumnType.String }),
      buildColumn({ columnName: 'is_main_member', columnType: AcEnumDDColumnType.Integer, defaultValue: 0 }),
      buildColumn({ columnName: 'unique_member_seq', columnType: AcEnumDDColumnType.Integer }),
      buildColumn({ columnName: 'fixed_member_number', columnType: AcEnumDDColumnType.String }),
    ];
    return t;
  },
};
