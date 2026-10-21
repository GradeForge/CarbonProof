import { createRecord } from './repository';
import type { EvidenceSubmissionInput } from './types';

const SAMPLE_SUBMISSIONS: EvidenceSubmissionInput[] = [
  {
    project_name: 'Highland Reforestation Initiative',
    org_id: 'ORG-REFOREST-001',
    claim_category: 'reforestation',
    country: 'Kenya',
    location_description: 'Aberdare Range, Nyandarua County',
    reporting_period_start: '2025-01-01',
    reporting_period_end: '2025-12-31',
    claimed_quantity: 12500,
    unit: 'tCO2e',
    evidence_reference: 'https://example.org/evidence/highland-reforestation-2025.pdf',
    evidence_description:
      'Annual monitoring report describing 250 hectares of restored native forest, with biomass surveys and GPS plot coordinates.',
  },
  {
    project_name: 'Coastal Wind Farm Phase 2',
    org_id: 'ORG-WIND-014',
    claim_category: 'renewable_energy',
    country: 'Portugal',
    location_description: 'Near Setubal, Atlantic coast',
    reporting_period_start: '2025-04-01',
    reporting_period_end: '2026-03-31',
    claimed_quantity: 84000,
    unit: 'tCO2e',
    evidence_reference: 'https://example.org/evidence/coastal-wind-p2-2026.pdf',
    evidence_description:
      'Grid operator generation records and metered output for 18 turbines commissioned in April 2025.',
  },
  {
    project_name: 'Landfill Methane Capture — Site 7',
    org_id: 'ORG-METHANE-007',
    claim_category: 'methane_reduction',
    country: 'Brazil',
    location_description: 'Metropolitan landfill, Sao Paulo outskirts',
    reporting_period_start: '2025-06-01',
    reporting_period_end: '2025-11-30',
    claimed_quantity: 3200,
    unit: 'tCO2e',
    evidence_reference: 'doi:10.5555/landfill-capture-site7',
    evidence_description:
      'Capture and flare log with methane concentration readings. Some monitoring gaps in week 9.',
  },
  {
    project_name: 'Municipal LED Streetlight Retrofit',
    org_id: 'ORG-EFF-202',
    claim_category: 'energy_efficiency',
    country: 'Vietnam',
    location_description: 'Da Nang citywide streetlight network',
    reporting_period_start: '2025-02-01',
    reporting_period_end: '2025-07-31',
    claimed_quantity: 1100,
    unit: 'tCO2e',
    evidence_reference: 'not-a-url',
    evidence_description:
      'Pre- and post-retrofit metering data for 4,200 luminaires, baseline adjusted for seasonal usage.',
  },
];

export async function seedSampleData(): Promise<{
  created: number;
  duplicates: number;
}> {
  let created = 0;
  let duplicates = 0;
  for (const input of SAMPLE_SUBMISSIONS) {
    try {
      const result = await createRecord(input, true);
      if ('duplicate' in result) {
        duplicates += 1;
      } else {
        created += 1;
      }
    } catch {
      duplicates += 1;
    }
  }
  return { created, duplicates };
}
