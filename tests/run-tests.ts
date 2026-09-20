import path from 'path';
import fs from 'fs';
import assert from 'assert';
import axios from 'axios';
import { determineIsAdult18Plus, calculateFormFees } from '../src/services/fee-calculator';
import { DbService, MySqlDbConfig } from '../src/database/db-service';
import { UserRole, FormStatus, FormRow, MemberRow } from '../src/database/schema';
import { generateReceiptPdf } from '../src/services/pdf-receipt';
import { createServer } from '../src/server';
import { envConfig } from '../src/config/env';
import { AcMysqlDao, AcSqlConnection } from 'ac-sql';
import {
  SamaajImporter,
  convertGujaratiDigits,
  translateRelation,
  deriveTalukaAndDistrict,
} from '../src/services/samaaj-importer';

async function runAllTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 Starting ABKKPSS Test Suite (Automated Verification)');
  console.log('🧪 ========================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function recordPass(testName: string) {
    passedCount++;
    console.log(`  ✅ PASS: ${testName}`);
  }

  function recordFail(testName: string, err: any) {
    failedCount++;
    console.error(`  ❌ FAIL: ${testName}`, err);
  }

  // TEST 1: Age Determination Cutoff Rule (31-12-2026 Cutoff / Born <= 31-12-2008)
  console.log('--- TEST GROUP 1: Business Logic & 18+ Member Age Determination ---');
  try {
    // Exact cutoff edge cases
    assert.strictEqual(determineIsAdult18Plus('31-12-2008'), true, 'Born on 31-12-2008 must be 18+ by 31-12-2026');
    assert.strictEqual(determineIsAdult18Plus('30-12-2008'), true, 'Born on 30-12-2008 must be 18+');
    assert.strictEqual(determineIsAdult18Plus('01-01-2009'), false, 'Born on 01-01-2009 is under 18 by 31-12-2026');
    assert.strictEqual(determineIsAdult18Plus('2008-12-31'), true, 'ISO format 2008-12-31 must be 18+');
    assert.strictEqual(determineIsAdult18Plus('2009-01-01'), false, 'ISO format 2009-01-01 must be under 18');
    assert.strictEqual(determineIsAdult18Plus('15-08-1990'), true, 'Born in 1990 must be 18+');
    // Numeric age inputs
    assert.strictEqual(determineIsAdult18Plus('25'), true, 'Age 25 must be 18+');
    assert.strictEqual(determineIsAdult18Plus('18'), true, 'Age 18 must be 18+');
    assert.strictEqual(determineIsAdult18Plus('12'), false, 'Age 12 must not be 18+');
    recordPass('18+ Cutoff Date Rule (31/12/2026 Cutoff - Born on or before 31/12/2008)');
  } catch (err) {
    recordFail('18+ Cutoff Date Rule', err);
  }

  // TEST 1B: Gujarati Translation and Numeral Conversion Utilities
  console.log('\n--- TEST GROUP 1B: Gujarati Translation & Data Normalization ---');
  try {
    // Gujarati numerals to ASCII
    assert.strictEqual(convertGujaratiDigits('૩૮૨૨૧૦'), '382210');
    assert.strictEqual(convertGujaratiDigits('૦૧/૦૨/૨૦૨૩'), '01/02/2023');

    // Gujarati relations to English
    assert.strictEqual(translateRelation('પોતે', true), 'Self');
    assert.strictEqual(translateRelation('પત્ની'), 'Wife');
    assert.strictEqual(translateRelation('પુત્ર'), 'Son');
    assert.strictEqual(translateRelation('પુત્રી'), 'Daughter');
    assert.strictEqual(translateRelation('મા'), 'Mother');
    assert.strictEqual(translateRelation('પિતા'), 'Father');

    // Native place to taluka & district derivation
    const dolatpar = deriveTalukaAndDistrict('Dolatpar');
    assert.strictEqual(dolatpar.taluka, 'Lakhpat');
    assert.strictEqual(dolatpar.district, 'Kutch');

    const amara = deriveTalukaAndDistrict('Amara');
    assert.strictEqual(amara.taluka, 'Nakhatrana');
    assert.strictEqual(amara.district, 'Kutch');

    recordPass('Gujarati numerals conversion, relation translation & taluka derivation');
  } catch (err) {
    recordFail('Gujarati Normalization & Translation', err);
  }

  // TEST 2: Fee Calculation Formula (₹500 × 18+ Members)
  console.log('\n--- TEST GROUP 2: Lifetime Membership Fee Formula (₹500 × 18+ Count) ---');
  try {
    const testMembers = [
      { name: 'Rameshbhai (Father)', dob: '10-05-1975' }, // Adult (18+)
      { name: 'Geetaben (Mother)', dob: '22-09-1978' },  // Adult (18+)
      { name: 'Jigar (Elder Son)', dob: '15-06-2005' },  // Adult (18+)
      { name: 'Kavita (Daughter)', dob: '14-11-2010' },  // Minor (< 18)
      { name: 'Meet (Younger Son)', dob: '05-03-2015' }, // Minor (< 18)
    ];

    const calculation = calculateFormFees(testMembers);
    assert.strictEqual(calculation.totalAdultsCount, 3, 'Expected exactly 3 adult members (18+)');
    assert.strictEqual(calculation.totalAmount, 1500, 'Expected total fee = 3 * 500 = ₹1500');
    assert.strictEqual(calculation.evaluatedMembers[0].is_adult_18_plus, true);
    assert.strictEqual(calculation.evaluatedMembers[3].is_adult_18_plus, false);
    recordPass('Fee Formula Calculation: 3 Adults × ₹500 = ₹1500');
  } catch (err) {
    recordFail('Fee Formula Calculation', err);
  }

  // TEST 3: Database Engine via ac-sql exclusively (MySQL AcMysqlDao, No Raw SQL)
  console.log('\n--- TEST GROUP 3: Database Initialization & CRUD via ac-sql exclusively (MySQL) ---');
  const testDbConfig: MySqlDbConfig = {
    hostname: envConfig.MYSQL_HOST,
    port: envConfig.MYSQL_PORT,
    username: envConfig.MYSQL_USER,
    password: envConfig.MYSQL_PASSWORD,
    database: 'abkkpss_forms_test_db',
  };

  // Clean test database if exists
  const tempDao = new AcMysqlDao();
  const tempConn = new AcSqlConnection();
  tempConn.hostname = testDbConfig.hostname || '127.0.0.1';
  tempConn.port = testDbConfig.port || 3306;
  tempConn.username = testDbConfig.username || 'root';
  tempConn.password = testDbConfig.password || '';
  tempConn.database = testDbConfig.database || 'abkkpss_forms_test_db';
  await tempDao.setSqlConnection({ sqlConnection: tempConn });
  try {
    const rawConn = await tempDao.getConnectionObject({ includeDatabase: false });
    await rawConn.execute(`DROP DATABASE IF EXISTS \`${testDbConfig.database}\``);
    await rawConn.end();
  } catch (e) {}

  DbService.resetInstance();
  const db = DbService.getInstance();
  try {
    await db.initialize(testDbConfig);

    // Verify tables exist
    const usersExist = await db.dao.checkTableExist({ tableName: 'users' });
    const formsExist = await db.dao.checkTableExist({ tableName: 'forms' });
    const membersExist = await db.dao.checkTableExist({ tableName: 'members' });

    assert.strictEqual(usersExist.value, true, 'users table must exist');
    assert.strictEqual(formsExist.value, true, 'forms table must exist');
    assert.strictEqual(membersExist.value, true, 'members table must exist');

    // Verify seeded users
    const adminUser = await db.getUserByUsername('admin');
    assert.ok(adminUser, 'Admin user must be seeded');
    assert.strictEqual(adminUser?.role, UserRole.SUPER_ADMIN);

    const zoneUser = await db.getUserByUsername('user_zone01');
    assert.ok(zoneUser, 'Zone 01 user must be seeded');
    assert.strictEqual(zoneUser?.zone_id, '01');

    // Test form and members insertion via ac-sql abstraction wrappers
    const newForm: FormRow = {
      zone_number: '01',
      family_number: '45',
      current_city_or_place: 'Ahmedabad',
      address_line_1: 'B-102, Shanti Heights',
      address_line_2: 'Satellite',
      city_name: 'Ahmedabad',
      state_name: 'Gujarat',
      country_name: 'India',
      residential_address: 'B-102, Shanti Heights, Satellite, Ahmedabad, Gujarat, India, PIN - 380015',
      firm_name: 'Patel Enterprise',
      firm_address_line_1: 'Shop 4, Commercial Complex',
      firm_address_line_2: 'CG Road',
      firm_city_name: 'Ahmedabad',
      firm_state_name: 'Gujarat',
      firm_country_name: 'India',
      firm_postal_code: '380009',
      firm_address: 'Shop 4, Commercial Complex, CG Road, Ahmedabad, Gujarat, India, PIN - 380009',
      native_place: 'Kutch',
      surname: 'Patel',
      gotra: 'Kashyap',
      taluka: 'Bhuj',
      district: 'Kutch',
      pincode: '380015',
      filler_name: 'Pravinbhai Patel',
      filler_mobile: '9876543210',
      total_adults_count: 2,
      total_amount: 1000,
      payment_mode: 'Cash',
      status: FormStatus.PENDING,
      created_by: adminUser!.id!,
      created_at: new Date().toISOString(),
    };

    const newMembers = [
      { serial_no: 1, name: 'Pravinbhai Patel', dob: '12-08-1970', is_adult_18_plus: true, gender: 'M' as const, relation: 'Self', education: 'Graduate', mobile_number: '9876543210', blood_group: 'B+' },
      { serial_no: 2, name: 'Bhavanaben Patel', dob: '04-03-1974', is_adult_18_plus: true, gender: 'F' as const, relation: 'Wife', education: 'HSC', mobile_number: '9876543211', blood_group: 'A+' },
      { serial_no: 3, name: 'Aarav Patel', dob: '10-10-2012', is_adult_18_plus: false, gender: 'M' as const, relation: 'Son', education: 'School', mobile_number: '', blood_group: 'B+' },
    ];

    const created = await db.createForm(newForm, newMembers);
    assert.ok(created?.formId, 'Form should be created with valid ID');

    // Query back via ac-sql
    const fetched = await db.getFormById(created!.formId);
    assert.ok(fetched, 'Form should be retrieved');
    assert.strictEqual(fetched?.form.family_number, '45');
    assert.strictEqual(fetched?.members.length, 3);
    assert.strictEqual(fetched?.form.total_amount, 1000);

    // Test family prefill lookup
    const existingFamily = await db.findExistingFamily('01', '45');
    assert.ok(existingFamily, 'Existing family record should be found');
    assert.strictEqual(existingFamily?.form.filler_name, 'Pravinbhai Patel');

    recordPass('ac-sql Database Initialization, Schema & Exclusive CRUD operations');
  } catch (err) {
    recordFail('ac-sql Database CRUD', err);
  }

  // TEST 4: PDF Receipt Generation
  console.log('\n--- TEST GROUP 4: Styled ABKKPSS PDF Receipt Generation ---');
  try {
    const sampleForm = (await db.getFormById(1))!;
    sampleForm.form.receipt_number = 'ABKKPSS-2026-00001';
    sampleForm.members[0].fixed_member_number = 'Z01-F45-M01';
    sampleForm.members[1].fixed_member_number = 'Z01-F45-M02';
    sampleForm.members[2].fixed_member_number = 'Z01-F45-M03';

    const pdfBuffer = await generateReceiptPdf({
      form: sampleForm.form,
      members: sampleForm.members,
      approvalDate: '07/09/2026',
      approverName: 'admin',
    });

    assert.ok(Buffer.isBuffer(pdfBuffer), 'Generated receipt should be a Buffer');
    assert.ok(pdfBuffer.length > 1000, 'PDF buffer should be non-empty');
    assert.strictEqual(pdfBuffer.subarray(0, 4).toString(), '%PDF', 'Buffer should contain valid PDF header (%PDF)');
    recordPass(`Styled PDF Receipt Generated (${pdfBuffer.length} bytes, valid %PDF header)`);
  } catch (err) {
    recordFail('PDF Receipt Generation', err);
  }

  // TEST 5: Full-Stack Web API & ac-web Server Boot
  console.log('\n--- TEST GROUP 5: Full-Stack Server & ac-web API Controllers ---');
  const testPort = 3099;
  let serverApp: any = null;

  try {
    serverApp = await createServer(testPort, testDbConfig);
    const baseUrl = `http://localhost:${testPort}`;

    // 1. Test Static UI index.html
    const indexRes = await axios.get(`${baseUrl}/`);
    assert.strictEqual(indexRes.status, 200);
    assert.ok(indexRes.data.includes('<abkkpss-app>'), 'Should serve index.html with <abkkpss-app> Web Component');
    recordPass('GET / serves CoreUI Bootstrap frontend with <abkkpss-app>');

    // 2. Test Login API
    const loginRes = await axios.post(`${baseUrl}/api/auth/login`, {
      username: 'admin',
      password: 'admin123',
    });
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.data.success, true);
    assert.ok(loginRes.data.token, 'Token must be returned');
    const adminToken = loginRes.data.token;
    recordPass('POST /api/auth/login authenticates Super Admin and returns JWT');

    // 3. Test Regular User Zone 01 Login
    const regLoginRes = await axios.post(`${baseUrl}/api/auth/login`, {
      username: 'user_zone01',
      password: 'user123',
    });
    assert.strictEqual(regLoginRes.data.user.zone_id, '01');
    const regToken = regLoginRes.data.token;
    recordPass('POST /api/auth/login authenticates Regular User with Zone 01');

    // 3B. Test Admin User Password Update functionality
    const userZone01 = await db.getUserByUsername('user_zone01');
    assert.ok(userZone01?.id, 'user_zone01 must have an id');

    // Reject short password (< 4 chars)
    try {
      await axios.post(
        `${baseUrl}/api/users/${userZone01!.id}/password`,
        { password: '12' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      assert.fail('Should reject password shorter than 4 characters');
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 400);
      recordPass('POST /api/users/:id/password rejects passwords shorter than 4 characters with 400');
    }

    // Reject regular user updating password
    try {
      await axios.post(
        `${baseUrl}/api/users/${userZone01!.id}/password`,
        { password: 'validpass123' },
        { headers: { Authorization: `Bearer ${regToken}` } }
      );
      assert.fail('Regular user must not be permitted to update passwords');
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 403);
      recordPass('POST /api/users/:id/password blocks non-admin with 403 Forbidden');
    }

    // Successfully update password via POST /api/users/:id/password
    const updatePassRes = await axios.post(
      `${baseUrl}/api/users/${userZone01!.id}/password`,
      { password: 'newsecretpass123' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert.strictEqual(updatePassRes.status, 200);
    assert.strictEqual(updatePassRes.data.success, true);

    // Verify old password fails
    try {
      await axios.post(`${baseUrl}/api/auth/login`, {
        username: 'user_zone01',
        password: 'user123',
      });
      assert.fail('Old password should no longer work');
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 401);
    }

    // Verify new password succeeds
    const newLoginRes = await axios.post(`${baseUrl}/api/auth/login`, {
      username: 'user_zone01',
      password: 'newsecretpass123',
    });
    assert.strictEqual(newLoginRes.status, 200);
    assert.strictEqual(newLoginRes.data.success, true);
    recordPass('POST /api/users/:id/password updates password and enables login with new credentials');

    // Also test PUT /api/users/:id to restore password to user123
    const putPassRes = await axios.put(
      `${baseUrl}/api/users/${userZone01!.id}`,
      { password: 'user123' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert.strictEqual(putPassRes.status, 200);
    assert.strictEqual(putPassRes.data.success, true);
    recordPass('PUT /api/users/:id successfully updates user password');

    // 3C. Test Self-Service Password Update via POST /api/auth/update-password
    // Reject unauthenticated request (no token)
    try {
      await axios.post(`${baseUrl}/api/auth/update-password`, {
        currentPassword: 'user123',
        newPassword: 'newpass123',
      });
      assert.fail('Should reject unauthenticated password update');
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 401);
      recordPass('POST /api/auth/update-password rejects unauthenticated request with 401');
    }

    // Reject missing current password
    try {
      await axios.post(
        `${baseUrl}/api/auth/update-password`,
        { newPassword: 'newpass123' },
        { headers: { Authorization: `Bearer ${regToken}` } }
      );
      assert.fail('Should reject missing current password');
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 400);
      recordPass('POST /api/auth/update-password rejects missing current password with 400');
    }

    // Reject incorrect current password
    try {
      await axios.post(
        `${baseUrl}/api/auth/update-password`,
        { currentPassword: 'wrongpassword', newPassword: 'newpass123' },
        { headers: { Authorization: `Bearer ${regToken}` } }
      );
      assert.fail('Should reject incorrect current password');
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 400);
      assert.ok(err.response?.data?.error?.includes('incorrect'));
      recordPass('POST /api/auth/update-password rejects wrong current password with 400');
    }

    // Reject short new password (< 4 chars)
    try {
      await axios.post(
        `${baseUrl}/api/auth/update-password`,
        { currentPassword: 'user123', newPassword: '12' },
        { headers: { Authorization: `Bearer ${regToken}` } }
      );
      assert.fail('Should reject short new password');
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 400);
      recordPass('POST /api/auth/update-password rejects short new password (< 4 chars) with 400');
    }

    // Successfully update password for regular user
    const selfUpdateRes = await axios.post(
      `${baseUrl}/api/auth/update-password`,
      { currentPassword: 'user123', newPassword: 'selfnewpass123' },
      { headers: { Authorization: `Bearer ${regToken}` } }
    );
    assert.strictEqual(selfUpdateRes.status, 200);
    assert.strictEqual(selfUpdateRes.data.success, true);

    // Verify old password fails
    try {
      await axios.post(`${baseUrl}/api/auth/login`, {
        username: 'user_zone01',
        password: 'user123',
      });
      assert.fail('Old password should fail after self update');
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 401);
    }

    // Verify new password succeeds
    const selfNewLoginRes = await axios.post(`${baseUrl}/api/auth/login`, {
      username: 'user_zone01',
      password: 'selfnewpass123',
    });
    assert.strictEqual(selfNewLoginRes.status, 200);
    const selfNewToken = selfNewLoginRes.data.token;
    recordPass('POST /api/auth/update-password allows regular user to update their own password');

    // Restore password back to user123
    await axios.post(
      `${baseUrl}/api/auth/update-password`,
      { currentPassword: 'selfnewpass123', newPassword: 'user123' },
      { headers: { Authorization: `Bearer ${selfNewToken}` } }
    );
    recordPass('POST /api/auth/update-password restored user123 password');

    // 3D. Test Edit Username & Role via PUT /api/users/:id
    // Regular user cannot edit users
    try {
      await axios.put(
        `${baseUrl}/api/users/${userZone01!.id}`,
        { username: 'hacked_name' },
        { headers: { Authorization: `Bearer ${regToken}` } }
      );
      assert.fail('Regular user must not be permitted to edit users');
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 403);
      recordPass('PUT /api/users/:id blocks non-admin with 403 Forbidden');
    }

    // Reject duplicate username (409 Conflict)
    try {
      await axios.put(
        `${baseUrl}/api/users/${userZone01!.id}`,
        { username: 'admin' },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      assert.fail('Should reject already taken username');
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 409);
      assert.ok(err.response?.data?.error?.includes('already exists'));
      recordPass('PUT /api/users/:id rejects duplicate username with 409 Conflict');
    }

    // Successfully edit username and role
    const editUserRes = await axios.put(
      `${baseUrl}/api/users/${userZone01!.id}`,
      { username: 'user_zone01_edited', role: UserRole.ADMIN, zone_id: '01' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert.strictEqual(editUserRes.status, 200);
    assert.strictEqual(editUserRes.data.success, true);

    const editedUserInDb = await db.getUserById(userZone01!.id!);
    assert.strictEqual(editedUserInDb?.username, 'user_zone01_edited');
    assert.strictEqual(editedUserInDb?.role, UserRole.ADMIN);
    recordPass('PUT /api/users/:id successfully updates username and role');

    // Restore username and role back to user_zone01 and REGULAR_USER
    await axios.put(
      `${baseUrl}/api/users/${userZone01!.id}`,
      { username: 'user_zone01', role: UserRole.REGULAR_USER, zone_id: '01' },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    recordPass('PUT /api/users/:id restored user_zone01 original username and role');

    // 4. Test Distinct Values Endpoint
    const distinctRes = await axios.get(`${baseUrl}/api/forms/distinct-values`, {
      headers: { Authorization: `Bearer ${regToken}` },
    });
    assert.strictEqual(distinctRes.status, 200);
    assert.strictEqual(distinctRes.data.success, true);
    assert.ok(Array.isArray(distinctRes.data.values.surnames), 'surnames list must be an array');
    assert.ok(Array.isArray(distinctRes.data.values.gotras), 'gotras list must be an array');
    assert.ok(Array.isArray(distinctRes.data.values.states), 'states list must be an array');
    assert.ok(Array.isArray(distinctRes.data.values.countries), 'countries list must be an array');
    assert.ok(!distinctRes.data.values.villages, 'villages list should not exist');
    assert.ok(Array.isArray(distinctRes.data.values.blood_groups), 'blood_groups list must be an array');
    assert.strictEqual(distinctRes.data.values.blood_groups.length, 8, 'Must provide all 8 standard blood groups');
    assert.ok(distinctRes.data.values.blood_groups.includes('O+'));
    assert.ok(distinctRes.data.values.blood_groups.includes('AB-'));
    assert.ok(Array.isArray(distinctRes.data.values.zones), 'zones list must be an array');
    assert.strictEqual(distinctRes.data.values.zones.length, 11, 'Must provide all 11 standard zones');
    assert.strictEqual(distinctRes.data.values.zones[0].code, '01');
    assert.strictEqual(distinctRes.data.values.zones[0].label, '01 - Ahmedabad');
    assert.strictEqual(distinctRes.data.values.zones[10].code, '11');
    assert.strictEqual(distinctRes.data.values.zones[10].label, '11 - West Kutch');
    recordPass('GET /api/forms/distinct-values returns 11 standard zones, states, countries & 8 blood groups');

    // 5. Test Form Submission with separated address fields, 3-part names, derived filler, and +91 mobile prefix
    const submitRes = await axios.post(
      `${baseUrl}/api/forms`,
      {
        zone_number: '01',
        family_number: '99',
        address_line_1: '12, Main Bazar',
        address_line_2: 'Near Tower',
        city_name: 'Bhuj',
        state_name: 'Gujarat',
        country_name: 'India',
        firm_name: 'Bhuj Traders',
        firm_address_line_1: 'Plot 5, GIDC',
        firm_address_line_2: 'Station Road',
        firm_city_name: 'Bhuj',
        firm_state_name: 'Gujarat',
        firm_country_name: 'India',
        firm_postal_code: '370001',
        native_place: 'Kutch',
        surname: 'Patel',
        gotra: 'Kashyap',
        taluka: 'Bhuj',
        district: 'Kutch',
        pincode: '370001',
        // filler_name and filler_mobile omitted to test automatic derivation from Member 1
        payment_mode: 'Cash',
        members: [
          {
            serial_no: 1,
            first_name: 'Jayeshbhai',
            middle_name: 'Pravinbhai',
            last_name: 'Patel',
            dob: '1985-05-10',
            gender: 'M',
            relation: 'Self',
            mobile_number: '9825098250',
            blood_group: 'B+',
          }, // Adult
          {
            serial_no: 2,
            first_name: 'Rekhaben',
            middle_name: 'Jayeshbhai',
            last_name: 'Patel',
            dob: '1987-08-15',
            gender: 'F',
            relation: 'Wife',
            blood_group: 'A+',
          }, // Adult
          {
            serial_no: 3,
            first_name: 'Diya',
            middle_name: 'Jayeshbhai',
            last_name: 'Patel',
            dob: '2015-02-20',
            gender: 'F',
            relation: 'Daughter',
            blood_group: 'B+',
          }, // Minor
        ],
      },
      {
        headers: { Authorization: `Bearer ${regToken}` },
      }
    );
    assert.strictEqual(submitRes.status, 201);
    assert.strictEqual(submitRes.data.totalAdultsCount, 2);
    assert.strictEqual(submitRes.data.totalAmount, 1000);
    const createdFormId = submitRes.data.formId;

    // Verify derived filler details, separated address fields, +91 mobile normalization, and 3-part name persistence
    const savedFormData = await db.getFormById(createdFormId);
    assert.strictEqual(savedFormData?.form.address_line_1, '12, Main Bazar');
    assert.strictEqual(savedFormData?.form.city_name, 'Bhuj');
    assert.strictEqual(savedFormData?.form.firm_name, 'Bhuj Traders');
    assert.strictEqual(savedFormData?.form.firm_city_name, 'Bhuj');
    assert.strictEqual(savedFormData?.form.filler_name, 'Jayeshbhai Pravinbhai Patel', 'Filler name must be derived from Member 1');
    assert.strictEqual(savedFormData?.form.filler_mobile, '+91 9825098250', 'Filler mobile must be +91 prefixed from Member 1');
    assert.strictEqual(savedFormData?.form.payment_mode, 'Cash', 'Payment mode must be Cash');
    assert.strictEqual(savedFormData?.members[0].first_name, 'Jayeshbhai');
    assert.strictEqual(savedFormData?.members[0].middle_name, 'Pravinbhai');
    assert.strictEqual(savedFormData?.members[0].last_name, 'Patel');
    assert.strictEqual(savedFormData?.members[0].mobile_number, '+91 9825098250');
    assert.strictEqual(savedFormData?.members[0].blood_group, 'B+');
    recordPass(`POST /api/forms submitted with separated address fields, 3-part names, auto-derived filler & +91 mobile (Form #${createdFormId})`);

    // 6. Test Mobile Validation: Reject invalid mobile number (< 10 digits)
    try {
      await axios.post(
        `${baseUrl}/api/forms`,
        {
          zone_number: '01',
          family_number: '102',
          address_line_1: 'Address Line 1',
          city_name: 'Ahmedabad',
          state_name: 'Gujarat',
          country_name: 'India',
          surname: 'Patel',
          gotra: 'Kashyap',
          taluka: 'Bhuj',
          district: 'Kutch',
          pincode: '380015',
          members: [
            {
              serial_no: 1,
              first_name: 'Test',
              dob: '1980-01-01',
              relation: 'Self',
              gender: 'M',
              mobile_number: '12345', // Invalid: only 5 digits
            },
          ],
        },
        { headers: { Authorization: `Bearer ${regToken}` } }
      );
      assert.fail('Should have rejected form submission with invalid mobile number');
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 400, 'Should return 400 Bad Request for invalid mobile number');
      assert.ok(err.response?.data?.error?.includes('mobile number'), 'Error message should indicate mobile number issue');
      recordPass('Mobile Validation: Submission with invalid < 10 digits mobile rejected with 400');
    }

    // 5. Test Gujarati Input Rejection (English-only enforcement)
    try {
      await axios.post(
        `${baseUrl}/api/forms`,
        {
          zone_number: '01',
          family_number: '101',
          current_city_or_place: '\u0A85\u0AAE\u0AA6\u0ABE\u0AB5\u0ABE\u0AA6', // Gujarati: અમદાવાદ
          residential_address: 'Address',
          filler_name: 'Test Name',
          filler_mobile: '9876543210',
          members: [{ name: 'Test', dob: '1980-01-01', relation: 'Self', gender: 'M' }],
        },
        { headers: { Authorization: `Bearer ${regToken}` } }
      );
      assert.fail('Should have rejected submission containing Gujarati characters');
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 400, 'Should return 400 Bad Request for Gujarati characters');
      assert.ok(err.response?.data?.error?.includes('English'), 'Error message should indicate English only');
      recordPass('English-Only Validation: Form submission with Gujarati text properly rejected with 400');
    }

    // 6. Test Regular User Zone Restriction (Should fail if Zone 01 user attempts Zone 02)
    try {
      await axios.post(
        `${baseUrl}/api/forms`,
        {
          zone_number: '02', // Mismatch with user's assigned Zone 01
          family_number: '10',
          filler_name: 'Test',
          filler_mobile: '9999999999',
          residential_address: 'Address',
          members: [{ name: 'Test', dob: '1980-01-01', relation: 'Self', gender: 'M' }],
        },
        { headers: { Authorization: `Bearer ${regToken}` } }
      );
      assert.fail('Should have rejected submission for different zone');
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 403, 'Should return 403 Forbidden for mismatched zone');
      recordPass('RBAC Zone Restriction: Regular user prevented from submitting for unauthorized zone');
    }

    // 6. Test Admin Approval & Receipt Generation Endpoint
    const approveRes = await axios.post(
      `${baseUrl}/api/forms/${createdFormId}/approve`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert.strictEqual(approveRes.status, 200);
    assert.strictEqual(approveRes.data.success, true);
    assert.ok(approveRes.data.receiptNumber, 'Receipt number should be assigned');
    recordPass(`POST /api/forms/${createdFormId}/approve generated receipt & queued WhatsApp`);

    // 7. Test Member ID Format: [ZoneNumber]/[FamilyNumber]/[MemberNo]-[Unique Member Id] (e.g. 01/99/01-00001)
    const approvedData = await db.getFormById(createdFormId);
    assert.ok(approvedData?.members[0].fixed_member_number, 'Member 1 must have fixed number');
    assert.strictEqual(approvedData?.members[0].fixed_member_number, '01/99/01-00001', 'Member 1 ID must be 01/99/01-00001');
    assert.strictEqual(approvedData?.members[1].fixed_member_number, '01/99/02-00002', 'Member 2 ID must be 01/99/02-00002');
    assert.strictEqual(approvedData?.members[2].fixed_member_number, '01/99/03-00003', 'Member 3 ID must be 01/99/03-00003');
    recordPass('Member ID format: [ZoneNumber]/[FamilyNumber]/[MemberNo]-[Unique Member Id] (01/99/01-00001)');

    // 8. Test Receipt PDF download endpoint (Family Full Receipt)
    const receiptStreamRes = await axios.get(`${baseUrl}/api/forms/${createdFormId}/receipt`, {
      responseType: 'arraybuffer',
    });
    assert.strictEqual(receiptStreamRes.status, 200);
    assert.strictEqual(receiptStreamRes.headers['content-type'], 'application/pdf');
    recordPass(`GET /api/forms/${createdFormId}/receipt streams generated PDF`);

    // 9. Test Individual Member Receipt PDF streaming endpoint
    const memberId = approvedData!.members[0].id!;
    const memberReceiptStreamRes = await axios.get(`${baseUrl}/api/forms/${createdFormId}/receipt?memberId=${memberId}`, {
      responseType: 'arraybuffer',
    });
    assert.strictEqual(memberReceiptStreamRes.status, 200);
    assert.strictEqual(memberReceiptStreamRes.headers['content-type'], 'application/pdf');
    assert.strictEqual(memberReceiptStreamRes.data.subarray(0, 4).toString(), '%PDF');
    recordPass(`GET /api/forms/${createdFormId}/receipt?memberId=${memberId} streams individual member receipt PDF`);

    // 10. Test Main Member selection and updating an unapproved form via PUT /api/forms/:id
    const form2Res = await axios.post(
      `${baseUrl}/api/forms`,
      {
        zone_number: '01',
        family_number: '150',
        address_line_1: 'Old Address Line 1',
        city_name: 'Bhuj',
        state_name: 'Gujarat',
        country_name: 'India',
        surname: 'Patel',
        gotra: 'Kashyap',
        taluka: 'Bhuj',
        district: 'Kutch',
        pincode: '370001',
        members: [
          {
            serial_no: 1,
            first_name: 'Hareshbhai',
            middle_name: 'Pravinbhai',
            dob: '1982-01-01',
            gender: 'M',
            relation: 'Brother',
            mobile_number: '9825011111',
            is_main_member: false,
          },
          {
            serial_no: 2,
            first_name: 'Kirtibhai',
            middle_name: 'Pravinbhai',
            dob: '1980-05-05',
            gender: 'M',
            relation: 'Self',
            mobile_number: '9825022222',
            is_main_member: true, // Selected as Main Family Member
          },
        ],
      },
      { headers: { Authorization: `Bearer ${regToken}` } }
    );
    const form2Id = form2Res.data.formId;
    const form2Data = await db.getFormById(form2Id);
    assert.strictEqual(form2Data?.form.filler_name, 'Kirtibhai Pravinbhai Patel', 'Filler name must be derived from Member 2 (Main Member)');
    assert.strictEqual(form2Data?.form.filler_mobile, '+91 9825022222', 'Filler mobile must be derived from Member 2 (Main Member)');
    recordPass('Main Family Member Radio selection properly designates filler_name & filler_mobile');

    // Update unapproved form via PUT /api/forms/:id
    const updateRes = await axios.put(
      `${baseUrl}/api/forms/${form2Id}`,
      {
        zone_number: '01',
        family_number: '150',
        address_line_1: 'Updated New Address Line 1',
        city_name: 'Gandhinagar',
        state_name: 'Gujarat',
        country_name: 'India',
        surname: 'Patel',
        gotra: 'Kashyap',
        taluka: 'Gandhinagar',
        district: 'Gandhinagar',
        pincode: '382010',
        members: [
          {
            serial_no: 1,
            first_name: 'Hareshbhai',
            middle_name: 'Pravinbhai',
            dob: '1982-01-01',
            gender: 'M',
            relation: 'Self',
            mobile_number: '9825011111',
            is_main_member: true,
          },
        ],
      },
      { headers: { Authorization: `Bearer ${regToken}` } }
    );
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.data.success, true);
    assert.strictEqual(updateRes.data.totalAdultsCount, 1);
    assert.strictEqual(updateRes.data.totalAmount, 500);

    const updatedDbForm = await db.getFormById(form2Id);
    assert.strictEqual(updatedDbForm?.form.address_line_1, 'Updated New Address Line 1');
    assert.strictEqual(updatedDbForm?.form.city_name, 'Gandhinagar');
    assert.strictEqual(updatedDbForm?.members.length, 1);
    assert.strictEqual(updatedDbForm?.form.total_amount, 500);
    recordPass(`PUT /api/forms/${form2Id} successfully updated unapproved form`);

    // 11. Test that PUT /api/forms/:id on already approved form returns 400 Bad Request
    try {
      await axios.put(
        `${baseUrl}/api/forms/${createdFormId}`,
        {
          zone_number: '01',
          family_number: '99',
          address_line_1: 'Should Fail',
          city_name: 'Bhuj',
          pincode: '370001',
          members: [
            {
              serial_no: 1,
              first_name: 'Jayeshbhai',
              dob: '1985-05-10',
              relation: 'Self',
              gender: 'M',
            },
          ],
        },
        { headers: { Authorization: `Bearer ${regToken}` } }
      );
      assert.fail('Should not allow editing approved form');
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 400);
      assert.ok(err.response?.data?.error?.includes('Approved'));
      recordPass('PUT /api/forms/:id properly blocks editing already approved forms with 400 Bad Request');
    }

    // 12. Test WhatsApp Status endpoint
    const waStatusRes = await axios.get(`${baseUrl}/api/whatsapp/status`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(waStatusRes.status, 200);
    assert.ok('status' in waStatusRes.data, 'WhatsApp status should be returned');
    recordPass('GET /api/whatsapp/status returns connection state');

    // 13. Test GET /api/forms/import/samaaj/preview
    const previewRes = await axios.get(`${baseUrl}/api/forms/import/samaaj/preview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(previewRes.status, 200);
    assert.strictEqual(previewRes.data.success, true);
    assert.strictEqual(previewRes.data.preview.totalFamilies, 961);
    assert.strictEqual(previewRes.data.preview.totalMembers, 6008);
    assert.ok(previewRes.data.preview.totalEstimatedAdults > 4000);
    assert.ok(previewRes.data.preview.sampleFamilies.length > 0);
    recordPass('GET /api/forms/import/samaaj/preview returns legacy migration stats (961 families, 6008 members)');

    // 14. Test POST /api/forms/import/samaaj/execute RBAC (Regular user blocked)
    try {
      await axios.post(
        `${baseUrl}/api/forms/import/samaaj/execute`,
        { limit: 2 },
        { headers: { Authorization: `Bearer ${regToken}` } }
      );
      assert.fail('Regular user must not be allowed to execute migration');
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 403);
      recordPass('POST /api/forms/import/samaaj/execute blocks non-superadmin with 403 Forbidden');
    }

    // 15. Test POST /api/forms/import/samaaj/execute by Super Admin
    const execRes = await axios.post(
      `${baseUrl}/api/forms/import/samaaj/execute`,
      { limit: 2, cleanExisting: false, skipExisting: false },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert.strictEqual(execRes.status, 200);
    assert.strictEqual(execRes.data.success, true);
    assert.strictEqual(execRes.data.result.importedFamilies, 2);
    recordPass('POST /api/forms/import/samaaj/execute successfully imports legacy families');

    // 16. Verify imported records are strictly PENDING (unapproved) with no receipt numbers
    const importedFamilyRes = await axios.get(`${baseUrl}/api/forms/search?zone=01&family=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(importedFamilyRes.status, 200);
    assert.strictEqual(importedFamilyRes.data.found, true);
    const impForm = importedFamilyRes.data.form;
    assert.strictEqual(impForm.status, FormStatus.PENDING, 'Imported records must be unapproved (PENDING)');
    assert.strictEqual(impForm.receipt_number, null, 'Imported records must not have receipt numbers');
    assert.strictEqual(impForm.payment_mode, 'Cash', 'Imported records payment mode must be Cash');
    const impMembers = importedFamilyRes.data.members;
    assert.ok(impMembers.length > 0, 'Imported family must have members');
    assert.strictEqual(impMembers[0].is_main_member, true, 'First member must be main member');
    assert.strictEqual(impMembers[0].fixed_member_number, null, 'Fixed member number must be null prior to approval');
    assert.strictEqual(impMembers[0].unique_member_seq, null, 'Unique sequence must be null prior to approval');
    recordPass('Imported records verified: strictly PENDING, null receipt, null member IDs, and auto-evaluated 18+ adult fees');

    // 17. Test GET /api/forms pagination
    const page1Res = await axios.get(`${baseUrl}/api/forms?page=1&pageSize=2`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(page1Res.status, 200);
    assert.strictEqual(page1Res.data.success, true);
    assert.strictEqual(page1Res.data.page, 1);
    assert.strictEqual(page1Res.data.pageSize, 2);
    assert.strictEqual(page1Res.data.forms.length, 2);
    assert.ok(page1Res.data.total >= 3, `Expected at least 3 total forms in test DB, got ${page1Res.data.total}`);
    assert.ok(page1Res.data.totalPages >= 2);

    const page2Res = await axios.get(`${baseUrl}/api/forms?page=2&pageSize=2`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(page2Res.status, 200);
    assert.strictEqual(page2Res.data.success, true);
    assert.strictEqual(page2Res.data.page, 2);
    assert.strictEqual(page2Res.data.pageSize, 2);
    assert.ok(page2Res.data.forms.length >= 1);
    const page1Ids = page1Res.data.forms.map((f: any) => f.id);
    const page2Ids = page2Res.data.forms.map((f: any) => f.id);
    assert.ok(!page1Ids.some((id: number) => page2Ids.includes(id)), 'Page 1 and Page 2 forms must not overlap');

    // Test status filtering with pagination
    const pendingPaginatedRes = await axios.get(`${baseUrl}/api/forms?status=PENDING&page=1&pageSize=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(pendingPaginatedRes.status, 200);
    assert.strictEqual(pendingPaginatedRes.data.page, 1);
    assert.strictEqual(pendingPaginatedRes.data.pageSize, 1);
    assert.strictEqual(pendingPaginatedRes.data.forms.length, 1);
    assert.strictEqual(pendingPaginatedRes.data.forms[0].status, 'PENDING');
    recordPass('GET /api/forms pagination verified: page, pageSize, total, totalPages and non-overlapping slices');

    // Test search filtering on GET /api/forms with bound SQL parameters
    const searchRes = await axios.get(`${baseUrl}/api/forms?search=Patel&page=1&pageSize=10`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(searchRes.status, 200);
    assert.strictEqual(searchRes.data.success, true);
    assert.ok(searchRes.data.forms.length > 0, 'Expected search for Patel to return forms');
    recordPass('GET /api/forms search filtering verified with bound SQL parameters');
  } catch (err) {
    recordFail('Full-Stack Server & ac-web API Controllers', err);
  } finally {
    if (serverApp) {
      await serverApp.stop();
      console.log('🛑 [Test Server] Server stopped.');
    }
    try {
      const cleanupConn = await tempDao.getConnectionObject({ includeDatabase: false });
      await cleanupConn.execute(`DROP DATABASE IF EXISTS \`${testDbConfig.database}\``);
      await cleanupConn.end();
    } catch (e) {}
  }

  console.log('\n========================================================');
  console.log(`📊 Test Summary: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('========================================================');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
