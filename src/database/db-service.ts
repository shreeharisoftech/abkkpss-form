import bcrypt from 'bcryptjs';
import {
  AcSqlConnection,
  AcSqlDatabase,
  AcSqlDbTable,
  AcMysqlDao,
} from 'ac-sql';
import { AcEnumSqlDatabaseType } from '@autocode-ts/autocode';
import { envConfig } from '../config/env';
import { STANDARD_DISTINCT_OPTIONS } from '../data/distinct-options';
import {
  DATA_DICTIONARY_NAME,
  defineAbkkpssDataDictionary,
  schemaDefinitions,
  UserRole,
  FormStatus,
  UserRow,
  FormRow,
  MemberRow,
} from './schema';

export interface MySqlDbConfig {
  hostname?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
}

export class DbService {
  private static instance: DbService;
  public dao!: AcMysqlDao;
  public usersTable!: AcSqlDbTable;
  public formsTable!: AcSqlDbTable;
  public membersTable!: AcSqlDbTable;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): DbService {
    if (!DbService.instance) {
      DbService.instance = new DbService();
    }
    return DbService.instance;
  }

  public static resetInstance(): void {
    DbService.instance = new DbService();
  }

  public async initialize(config?: MySqlDbConfig): Promise<void> {
    if (this.isInitialized) return;

    // Define and register the data dictionary schema
    defineAbkkpssDataDictionary();

    const hostname = config?.hostname || envConfig.MYSQL_HOST;
    const port = config?.port || envConfig.MYSQL_PORT;
    const username = config?.username || envConfig.MYSQL_USER;
    const password = config?.password !== undefined ? config.password : envConfig.MYSQL_PASSWORD;
    const database = config?.database || envConfig.MYSQL_DATABASE;

    const connection = new AcSqlConnection();
    connection.hostname = hostname;
    connection.port = port;
    connection.username = username;
    connection.password = password;
    connection.database = database;

    AcSqlDatabase.databaseType = AcEnumSqlDatabaseType.MySql;
    AcSqlDatabase.sqlConnection = connection;

    this.dao = new AcMysqlDao();
    await this.dao.setSqlConnection({ sqlConnection: connection });

    // Initialize/create the MySQL database if not exists
    await this.dao.createDatabase();

    // Verify and create tables using ac-data-dictionary and ac-sql
    for (const tableName of ['users', 'forms', 'members'] as const) {
      const existResult = await this.dao.checkTableExist({ tableName });
      const exists = existResult.isSuccess() && existResult.value === true;

      if (!exists) {
        const tableSchema = schemaDefinitions[tableName]();
        const createStatement = tableSchema.getCreateTableStatement({
          databaseType: AcEnumSqlDatabaseType.MySql,
        });
        await this.dao.executeStatement({ statement: createStatement });
      }
    }

    // Ensure separated address columns exist in forms table if table already existed
    try {
      const rawConn = await this.dao.getConnectionObject({ includeDatabase: true });
      const [cols]: any = await rawConn.execute(`SHOW COLUMNS FROM \`forms\``);
      const existingColNames = cols.map((c: any) => c.Field);
      const colsToAdd: [string, string][] = [
        ['address_line_1', 'VARCHAR(255) NULL'],
        ['address_line_2', 'VARCHAR(255) NULL'],
        ['city_name', 'VARCHAR(255) NULL'],
        ['state_name', 'VARCHAR(255) NULL DEFAULT "Gujarat"'],
        ['country_name', 'VARCHAR(255) NULL DEFAULT "India"'],
        ['firm_address_line_1', 'VARCHAR(255) NULL'],
        ['firm_address_line_2', 'VARCHAR(255) NULL'],
        ['firm_city_name', 'VARCHAR(255) NULL'],
        ['firm_state_name', 'VARCHAR(255) NULL DEFAULT "Gujarat"'],
        ['firm_country_name', 'VARCHAR(255) NULL DEFAULT "India"'],
        ['firm_postal_code', 'VARCHAR(255) NULL'],
      ];
      for (const [colName, colDef] of colsToAdd) {
        if (!existingColNames.includes(colName)) {
          await rawConn.execute(`ALTER TABLE \`forms\` ADD COLUMN \`${colName}\` ${colDef}`);
        }
      }
      if (existingColNames.includes('village')) {
        await rawConn.execute(`ALTER TABLE \`forms\` MODIFY COLUMN \`village\` VARCHAR(255) NULL`);
      }

      // Migrate members table if needed
      const [mCols]: any = await rawConn.execute(`SHOW COLUMNS FROM \`members\``);
      const existingMemberColNames = mCols.map((c: any) => c.Field);
      const memberColsToAdd: [string, string][] = [
        ['first_name', 'VARCHAR(255) NULL'],
        ['middle_name', 'VARCHAR(255) NULL'],
        ['last_name', 'VARCHAR(255) NULL'],
        ['is_main_member', 'INT DEFAULT 0'],
        ['unique_member_seq', 'INT NULL'],
      ];
      for (const [colName, colDef] of memberColsToAdd) {
        if (!existingMemberColNames.includes(colName)) {
          await rawConn.execute(`ALTER TABLE \`members\` ADD COLUMN \`${colName}\` ${colDef}`);
        }
      }

      await rawConn.end();
    } catch (e) {
      // Ignore if table was just created or already migrated
    }

    // Bind AcSqlDbTable instances
    this.usersTable = new AcSqlDbTable({
      tableName: 'users',
      dataDictionaryName: DATA_DICTIONARY_NAME,
    });
    this.usersTable.dao = this.dao;

    this.formsTable = new AcSqlDbTable({
      tableName: 'forms',
      dataDictionaryName: DATA_DICTIONARY_NAME,
    });
    this.formsTable.dao = this.dao;

    this.membersTable = new AcSqlDbTable({
      tableName: 'members',
      dataDictionaryName: DATA_DICTIONARY_NAME,
    });
    this.membersTable.dao = this.dao;

    this.isInitialized = true;

    // Seed default users if empty
    await this.seedDefaultUsers();
  }

  private async seedDefaultUsers(): Promise<void> {
    const checkResult = await this.usersTable.getRows({});
    if (checkResult.isSuccess() && checkResult.rows.length === 0) {
      const now = new Date().toISOString();
      const adminPass = await bcrypt.hash('admin123', 10);
      const userPass = await bcrypt.hash('user123', 10);

      const defaultUsers: UserRow[] = [
        {
          username: 'admin',
          password_hash: adminPass,
          role: UserRole.SUPER_ADMIN,
          zone_id: null,
          created_at: now,
        },
        {
          username: 'zone_admin',
          password_hash: adminPass,
          role: UserRole.ADMIN,
          zone_id: null,
          created_at: now,
        },
        {
          username: 'user_zone01',
          password_hash: userPass,
          role: UserRole.REGULAR_USER,
          zone_id: '01',
          created_at: now,
        },
        {
          username: 'user_zone02',
          password_hash: userPass,
          role: UserRole.REGULAR_USER,
          zone_id: '02',
          created_at: now,
        },
      ];

      for (const u of defaultUsers) {
        await this.usersTable.insertRow({ row: u });
      }
    }
  }

  // --- USERS CRUD ---
  async getUserByUsername(username: string): Promise<UserRow | null> {
    const res = await this.usersTable.getRows({
      condition: 'username = :username',
      parameters: { ':username': username },
    });
    if (res.isSuccess() && res.rows.length > 0) {
      return res.rows[0] as UserRow;
    }
    return null;
  }

  async getUserById(id: number): Promise<UserRow | null> {
    const res = await this.usersTable.getRows({
      condition: 'id = :id',
      parameters: { ':id': id },
    });
    if (res.isSuccess() && res.rows.length > 0) {
      return res.rows[0] as UserRow;
    }
    return null;
  }

  async getAllUsers(): Promise<UserRow[]> {
    const res = await this.usersTable.getRows({});
    if (res.isSuccess()) {
      return res.rows.map((r) => {
        const u = { ...r };
        delete u.password_hash;
        return u as UserRow;
      });
    }
    return [];
  }

  async createUser(user: UserRow): Promise<number | null> {
    const res = await this.usersTable.insertRow({ row: user });
    if (res.isSuccess()) {
      return (res.lastInsertedId ?? (res.rows?.[0]?.id as number)) || null;
    }
    return null;
  }

  async updateUser(id: number, fields: Partial<UserRow>): Promise<boolean> {
    const res = await this.usersTable.updateRow({
      tableName: 'users',
      row: fields,
      condition: 'id = :id',
      parameters: { ':id': id },
    });
    return res.isSuccess();
  }

  async deleteUser(id: number): Promise<boolean> {
    const res = await this.usersTable.deleteRows({
      condition: 'id = :id',
      parameters: { ':id': id },
    });
    return res.isSuccess();
  }

  private enrichMember(m: MemberRow): MemberRow {
    m.is_main_member = m.is_main_member === 1 || m.is_main_member === true;
    if (!m.first_name && m.name) {
      const parts = m.name.trim().split(/\s+/);
      if (parts.length === 1) {
        m.first_name = parts[0];
        m.middle_name = '';
        m.last_name = '';
      } else if (parts.length === 2) {
        m.first_name = parts[0];
        m.middle_name = '';
        m.last_name = parts[1];
      } else {
        m.first_name = parts[0];
        m.middle_name = parts.slice(1, -1).join(' ');
        m.last_name = parts[parts.length - 1];
      }
    }
    return m;
  }

  // --- FORMS CRUD ---
  async createForm(form: FormRow, members: Omit<MemberRow, 'form_id'>[]): Promise<{ formId: number } | null> {
    const formRes = await this.formsTable.insertRow({ row: form });
    if (!formRes.isSuccess()) return null;

    const formId = (formRes.lastInsertedId ?? (formRes.rows?.[0]?.id as number)) as number;
    if (!formId) return null;

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const fullName = (m.name || [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' ')).trim();
      const isMain = m.is_main_member === true || m.is_main_member === 1 || (i === 0 && !members.some((other) => other.is_main_member === true || other.is_main_member === 1));
      const memberRow: MemberRow = {
        form_id: formId,
        serial_no: m.serial_no || (i + 1),
        first_name: m.first_name || '',
        middle_name: m.middle_name || '',
        last_name: m.last_name || '',
        name: fullName,
        dob: m.dob,
        is_adult_18_plus: m.is_adult_18_plus ? 1 : 0,
        gender: m.gender,
        relation: m.relation,
        education: m.education || '',
        mobile_number: m.mobile_number || '',
        blood_group: m.blood_group || '',
        is_main_member: isMain ? 1 : 0,
        unique_member_seq: m.unique_member_seq || null,
        fixed_member_number: m.fixed_member_number || null,
      };
      await this.membersTable.insertRow({ row: memberRow });
    }

    return { formId };
  }

  async getFormById(id: number): Promise<{ form: FormRow; members: MemberRow[] } | null> {
    const formRes = await this.formsTable.getRows({
      condition: 'id = :id',
      parameters: { ':id': id },
    });
    if (!formRes.isSuccess() || formRes.rows.length === 0) return null;

    const form = formRes.rows[0] as FormRow;
    const membersRes = await this.membersTable.getRows({
      condition: 'form_id = :form_id',
      parameters: { ':form_id': id },
    });

    const members = ((membersRes.isSuccess() ? membersRes.rows : []) as MemberRow[]).map(this.enrichMember.bind(this));
    members.sort((a, b) => (a.serial_no ?? 0) - (b.serial_no ?? 0));

    return { form, members };
  }

  async getForms({
    zoneNumber,
    status,
    search,
    page = 1,
    pageSize = 10,
  }: {
    zoneNumber?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {}): Promise<{
    forms: FormRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const conditions: string[] = [];
    const parameters: Record<string, any> = {};

    if (zoneNumber) {
      conditions.push('zone_number = :zone_number');
      parameters[':zone_number'] = zoneNumber;
    }

    if (status && status !== 'ALL') {
      conditions.push('status = :status');
      parameters[':status'] = status;
    }

    if (search && search.trim()) {
      const searchPattern = `%${search.trim()}%`;
      conditions.push(
        '(family_number LIKE :search_family OR filler_name LIKE :search_name OR filler_mobile LIKE :search_mobile OR surname LIKE :search_surname OR city_name LIKE :search_city OR taluka LIKE :search_taluka)'
      );
      parameters[':search_family'] = searchPattern;
      parameters[':search_name'] = searchPattern;
      parameters[':search_mobile'] = searchPattern;
      parameters[':search_surname'] = searchPattern;
      parameters[':search_city'] = searchPattern;
      parameters[':search_taluka'] = searchPattern;
    }

    const condition = conditions.length > 0 ? conditions.join(' AND ') : '';

    // Query total count
    const countRes = await this.formsTable.getRows({
      selectStatement: 'SELECT COUNT(1) AS total FROM forms',
      condition,
      parameters: { ...parameters },
    });
    let total = 0;
    if (countRes.isSuccess() && countRes.rows.length > 0) {
      const row = countRes.rows[0] as any;
      total = Number(row.total ?? row['COUNT(1)'] ?? row['count(1)'] ?? 0);
    }

    const effectivePage = page > 0 ? page : 1;
    const effectivePageSize = pageSize > 0 ? pageSize : 10;

    const res = await this.formsTable.getRows({
      condition,
      parameters: { ...parameters },
      orderBy: 'id DESC',
      pageNumber: effectivePage,
      pageSize: effectivePageSize,
    });

    let forms: FormRow[] = [];
    if (res.isSuccess()) {
      forms = (res.rows as FormRow[]).sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    }

    const totalPages = Math.max(1, Math.ceil(total / effectivePageSize));

    return {
      forms,
      total,
      page: effectivePage,
      pageSize: effectivePageSize,
      totalPages,
    };
  }

  async findExistingFamily(zoneNumber: string, familyNumber: string): Promise<{ form: FormRow; members: MemberRow[] } | null> {
    const res = await this.formsTable.getRows({
      condition: 'zone_number = :zone AND family_number = :family',
      parameters: { ':zone': zoneNumber, ':family': familyNumber },
    });

    if (res.isSuccess() && res.rows.length > 0) {
      // Return the most recent record for this family
      const latestForm = res.rows[res.rows.length - 1] as FormRow;
      const membersRes = await this.membersTable.getRows({
        condition: 'form_id = :form_id',
        parameters: { ':form_id': latestForm.id },
      });
      const members = ((membersRes.isSuccess() ? membersRes.rows : []) as MemberRow[]).map(this.enrichMember.bind(this));
      members.sort((a, b) => (a.serial_no ?? 0) - (b.serial_no ?? 0));
      return { form: latestForm, members };
    }
    return null;
  }

  async updateFormStatus({
    id,
    status,
    approvedBy,
    receiptNumber,
  }: {
    id: number;
    status: FormStatus;
    approvedBy?: number;
    receiptNumber?: string;
  }): Promise<boolean> {
    const updatePayload: Partial<FormRow> = { status };
    if (approvedBy !== undefined) updatePayload.approved_by = approvedBy;
    if (receiptNumber !== undefined) updatePayload.receipt_number = receiptNumber;

    const res = await this.formsTable.updateRow({
      tableName: 'forms',
      row: updatePayload,
      condition: 'id = :id',
      parameters: { ':id': id },
    });
    return res.isSuccess();
  }

  async updateMemberFixedNumber(memberId: number, fixedMemberNumber: string, uniqueSeq?: number): Promise<boolean> {
    const row: any = { fixed_member_number: fixedMemberNumber };
    if (uniqueSeq !== undefined) row.unique_member_seq = uniqueSeq;
    const res = await this.membersTable.updateRow({
      tableName: 'members',
      row,
      condition: 'id = :id',
      parameters: { ':id': memberId },
    });
    return res.isSuccess();
  }

  async getNextUniqueMemberSeq(): Promise<number> {
    try {
      const rawConn = await this.dao.getConnectionObject({ includeDatabase: true });
      const [rows]: any = await rawConn.execute(
        `SELECT COALESCE(MAX(unique_member_seq), 0) AS max_seq FROM \`members\``
      );
      await rawConn.end();
      const maxSeq = rows?.[0]?.max_seq ? parseInt(rows[0].max_seq, 10) : 0;
      return maxSeq + 1;
    } catch {
      const res = await this.membersTable.getRows({
        condition: 'unique_member_seq IS NOT NULL',
      });
      let maxSeq = 0;
      if (res.isSuccess()) {
        for (const row of res.rows as MemberRow[]) {
          if (row.unique_member_seq && row.unique_member_seq > maxSeq) {
            maxSeq = row.unique_member_seq;
          }
        }
      }
      return maxSeq + 1;
    }
  }

  async updateForm(id: number, form: Partial<FormRow>, members: Omit<MemberRow, 'form_id'>[]): Promise<boolean> {
    const existing = await this.getFormById(id);
    if (!existing || existing.form.status === FormStatus.APPROVED) {
      return false;
    }

    const formUpdateRes = await this.formsTable.updateRow({
      tableName: 'forms',
      row: form,
      condition: 'id = :id',
      parameters: { ':id': id },
    });
    if (!formUpdateRes.isSuccess()) return false;

    await this.membersTable.deleteRows({
      condition: 'form_id = :form_id',
      parameters: { ':form_id': id },
    });

    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      const fullName = (m.name || [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' ')).trim();
      const isMain = m.is_main_member === true || m.is_main_member === 1 || (i === 0 && !members.some((other) => other.is_main_member === true || other.is_main_member === 1));
      const memberRow: MemberRow = {
        form_id: id,
        serial_no: m.serial_no || (i + 1),
        first_name: m.first_name || '',
        middle_name: m.middle_name || '',
        last_name: m.last_name || '',
        name: fullName,
        dob: m.dob,
        is_adult_18_plus: m.is_adult_18_plus ? 1 : 0,
        gender: m.gender,
        relation: m.relation,
        education: m.education || '',
        mobile_number: m.mobile_number || '',
        blood_group: m.blood_group || '',
        is_main_member: isMain ? 1 : 0,
        unique_member_seq: null,
        fixed_member_number: null,
      };
      await this.membersTable.insertRow({ row: memberRow });
    }

    return true;
  }

  async getNextReceiptNumber(): Promise<string> {
    const res = await this.formsTable.getRows({
      condition: "receipt_number IS NOT NULL AND receipt_number != ''",
    });

    const count = (res.isSuccess() ? res.rows.length : 0) + 1;
    return String(count).padStart(5, '0');
  }

  async getDistinctValues(): Promise<Record<string, any>> {
    const defaultData = STANDARD_DISTINCT_OPTIONS;
    const result: Record<string, any> = {
      zones: [...defaultData.zones],
      blood_groups: [...defaultData.blood_groups],
      surnames: [...defaultData.surnames],
      gotras: [...defaultData.gotras],
      native_places: [...defaultData.native_places],
      talukas: [...defaultData.talukas],
      districts: [...defaultData.districts],
      current_cities: [...defaultData.current_cities],
      states: [...defaultData.states],
      countries: [...defaultData.countries],
      pincodes: [...defaultData.pincodes],
      relations: [...defaultData.relations],
      educations: [...defaultData.educations],
    };

    try {
      const formsRes = await this.formsTable.getRows({});
      if (formsRes.isSuccess() && formsRes.rows.length > 0) {
        for (const row of formsRes.rows as FormRow[]) {
          if (row.surname && !result.surnames.includes(row.surname.trim())) result.surnames.push(row.surname.trim());
          if (row.gotra && !result.gotras.includes(row.gotra.trim())) result.gotras.push(row.gotra.trim());
          if (row.native_place && !result.native_places.includes(row.native_place.trim())) result.native_places.push(row.native_place.trim());
          if (row.taluka && !result.talukas.includes(row.taluka.trim())) result.talukas.push(row.taluka.trim());
          if (row.district && !result.districts.includes(row.district.trim())) result.districts.push(row.district.trim());
          const c = (row.city_name || row.current_city_or_place || '').trim();
          if (c && !result.current_cities.includes(c)) result.current_cities.push(c);
          if (row.firm_city_name && !result.current_cities.includes(row.firm_city_name.trim())) result.current_cities.push(row.firm_city_name.trim());
          if (row.state_name && !result.states.includes(row.state_name.trim())) result.states.push(row.state_name.trim());
          if (row.country_name && !result.countries.includes(row.country_name.trim())) result.countries.push(row.country_name.trim());
          if (row.pincode && !result.pincodes.includes(row.pincode.trim())) result.pincodes.push(row.pincode.trim());
          if (row.firm_postal_code && !result.pincodes.includes(row.firm_postal_code.trim())) result.pincodes.push(row.firm_postal_code.trim());
        }
      }

      const membersRes = await this.membersTable.getRows({});
      if (membersRes.isSuccess() && membersRes.rows.length > 0) {
        for (const row of membersRes.rows as MemberRow[]) {
          if (row.relation && !result.relations.includes(row.relation.trim())) result.relations.push(row.relation.trim());
          if (row.education && !result.educations.includes(row.education.trim())) result.educations.push(row.education.trim());
          if (row.blood_group && !result.blood_groups.includes(row.blood_group.trim())) result.blood_groups.push(row.blood_group.trim());
        }
      }
    } catch (err) {
      console.warn('[DbService] Note when gathering distinct values:', err);
    }

    for (const key of Object.keys(result)) {
      if (key !== 'blood_groups' && key !== 'zones') {
        result[key].sort((a: any, b: any) => a.localeCompare(b));
      }
    }

    return result;
  }
}
