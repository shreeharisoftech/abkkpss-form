import { DbService } from '../src/database/db-service';
import { SamaajImporter } from '../src/services/samaaj-importer';
import { envConfig } from '../src/config/env';

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isClean = args.includes('--clean');
  const isSkipExisting = args.includes('--skip-existing');

  let limit: number | undefined = undefined;
  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
  }

  console.log('===========================================================');
  console.log('  ABKKPSS Legacy Data Migration: samaaj_db -> abkkpss_forms_db');
  console.log('===========================================================');
  console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (Preview only, no data written)' : '🚀 LIVE IMPORT'}`);
  console.log(`Clean Existing Target Data: ${isClean ? 'YES' : 'NO'}`);
  console.log(`Skip Existing Families: ${isSkipExisting ? 'YES' : 'NO'}`);
  if (limit) console.log(`Limit: ${limit} families`);
  console.log('-----------------------------------------------------------\n');

  // Initialize target database
  const targetDb = DbService.getInstance();
  await targetDb.initialize();

  const importer = new SamaajImporter(
    {
      hostname: envConfig.MYSQL_HOST,
      port: envConfig.MYSQL_PORT,
      username: envConfig.MYSQL_USER,
      password: envConfig.MYSQL_PASSWORD,
      database: 'samaaj_db',
    },
    targetDb
  );

  if (isDryRun) {
    console.log('⏳ Running dry run analysis on samaaj_db...');
    const preview = await importer.dryRun();

    console.log('\n📊 Migration Preview Summary:');
    console.log(`- Total Families Identified: ${preview.totalFamilies}`);
    console.log(`- Total Members Identified: ${preview.totalMembers}`);
    console.log(`- Total Adults (18+): ${preview.totalEstimatedAdults}`);
    console.log(`- Total Lifetime Membership Fee (₹500 x Adults): ₹${preview.totalEstimatedFee.toLocaleString()}`);

    console.log('\n📍 Zone Distribution:');
    console.table(preview.zonesSummary);

    console.log('\n📋 Sample Mapped Family #1:');
    const sample = preview.sampleFamilies[0];
    if (sample) {
      console.log(`  Zone: ${sample.form.zone_number} | Family #: ${sample.form.family_number}`);
      console.log(`  Head of Family: ${sample.form.filler_name} | Mobile: ${sample.form.filler_mobile}`);
      console.log(`  Native Place: ${sample.form.native_place} | Taluka: ${sample.form.taluka} | District: ${sample.form.district}`);
      console.log(`  Gotra: ${sample.form.gotra} | Surname: ${sample.form.surname}`);
      console.log(`  Address: ${sample.form.residential_address}`);
      if (sample.form.firm_name) {
        console.log(`  Firm: ${sample.form.firm_name} (${sample.form.firm_address})`);
      }
      console.log(`  Status: ${sample.form.status} (Unapproved)`);
      console.log(`  Adults: ${sample.form.total_adults_count} | Total Amount: ₹${sample.form.total_amount}`);
      console.log(`  Members (${sample.members.length}):`);
      sample.members.forEach((m) => {
        console.log(
          `    [#${m.serial_no}] ${m.name} | Rel: ${m.relation} | DOB: ${m.dob} | 18+: ${m.is_adult_18_plus ? 'YES' : 'NO'} | Mobile: ${m.mobile_number || '-'} | Edu: ${m.education || '-'}`
        );
      });
    }

    console.log('\n✅ Dry run completed successfully! Run without --dry-run to perform live migration.');
  } else {
    console.log('⏳ Starting live data migration into target database...');
    const result = await importer.importAll({
      limit,
      cleanExisting: isClean,
      skipExisting: isSkipExisting,
      onProgress: (cur, total) => {
        const pct = Math.round((cur / total) * 100);
        process.stdout.write(`\r⏳ Processing: ${cur}/${total} families (${pct}%)...`);
      },
    });
    console.log();

    console.log('\n===========================================================');
    console.log(`🎉 Migration Completed in ${(result.durationMs / 1000).toFixed(2)}s`);
    console.log('===========================================================');
    console.log(`- Total Source Families: ${result.totalSourceFamilies}`);
    console.log(`- Successfully Imported Families: ${result.importedFamilies}`);
    console.log(`- Successfully Imported Members: ${result.importedMembers}`);
    console.log(`- Skipped Existing Families: ${result.skippedFamilies}`);
    console.log(`- Status of all imported forms: PENDING (Unapproved)`);

    if (result.errors.length > 0) {
      console.warn(`\n⚠️ Encountered ${result.errors.length} errors during migration:`);
      result.errors.slice(0, 10).forEach((e) => console.warn(`  - ${e}`));
      if (result.errors.length > 10) {
        console.warn(`  ... and ${result.errors.length - 10} more`);
      }
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal Migration Error:', err);
  process.exit(1);
});
