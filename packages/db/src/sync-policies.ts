import { readFile } from 'node:fs/promises';

import { syncPolicyVersion, type PolicyType } from './policies';

const CURRENT_POLICY_VERSION = '2026-06-28';

const policies: Array<{
	policyType: PolicyType;
	version: string;
	path: URL;
}> = [
	{
		policyType: 'terms',
		version: CURRENT_POLICY_VERSION,
		path: new URL('../../studio/src/lib/legal/terms.md', import.meta.url)
	},
	{
		policyType: 'privacy_policy',
		version: CURRENT_POLICY_VERSION,
		path: new URL('../../studio/src/lib/legal/privacy-policy.md', import.meta.url)
	}
];

for (const policy of policies) {
	const content = await readFile(policy.path, 'utf8');

	await syncPolicyVersion({
		policyType: policy.policyType,
		version: policy.version,
		content,
		isCurrent: true
	});

	console.log(`Synced ${policy.policyType} policy ${policy.version}`);
}
