import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('ships a formal JSON schema for public configs', async () => {
  const schema = JSON.parse(await readFile('./schema/open-bounty-radar.schema.json', 'utf8'));
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.title, 'Open Bounty Radar Configuration');
  assert.ok(schema.$defs.radarConfig);
  assert.ok(schema.$defs.scanConfig);
  assert.ok(schema.$defs.watchConfig);
  assert.ok(schema.$defs.listingSource);
});
