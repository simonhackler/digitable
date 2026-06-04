import { createHash } from 'node:crypto';
import { and, eq, notExists } from 'drizzle-orm';

import { db } from './client';
import { policyVersion, userPolicyAcceptance } from './schema';

export type PolicyType = 'terms' | 'privacy_policy';
export type PolicyAction = 'accepted' | 'acknowledged';

export type SyncPolicyInput = {
	policyType: PolicyType;
	version: string;
	content: string;
	isCurrent: boolean;
};

export type RecordCurrentPolicyAcceptancesInput = {
	userId: string;
	ipAddress?: string | null;
	userAgent?: string | null;
};

export function normalizePolicyContent(value: string) {
	return value.replace(/\r\n/g, '\n').trim() + '\n';
}

export function sha256(value: string) {
	return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function actionForPolicyType(policyType: PolicyType): PolicyAction {
	return policyType === 'terms' ? 'accepted' : 'acknowledged';
}

export async function syncPolicyVersion(input: SyncPolicyInput) {
	const content = normalizePolicyContent(input.content);
	const contentSha256 = sha256(content);

	const [existing] = await db
		.select()
		.from(policyVersion)
		.where(
			and(
				eq(policyVersion.policyType, input.policyType),
				eq(policyVersion.contentSha256, contentSha256)
			)
		)
		.limit(1);

	await db.transaction(async (tx) => {
		if (input.isCurrent) {
			await tx
				.update(policyVersion)
				.set({ isCurrent: false })
				.where(eq(policyVersion.policyType, input.policyType));
		}

		if (existing) {
			await tx
				.update(policyVersion)
				.set({
					version: input.version,
					content,
					isCurrent: input.isCurrent
				})
				.where(eq(policyVersion.id, existing.id));
			return;
		}

		await tx.insert(policyVersion).values({
			policyType: input.policyType,
			version: input.version,
			contentSha256,
			content,
			isCurrent: input.isCurrent
		});
	});
}

export async function getMissingCurrentPolicies(userId: string) {
	return db
		.select()
		.from(policyVersion)
		.where(
			and(
				eq(policyVersion.isCurrent, true),
				notExists(
					db
						.select({ id: userPolicyAcceptance.id })
						.from(userPolicyAcceptance)
						.where(
							and(
								eq(userPolicyAcceptance.userId, userId),
								eq(userPolicyAcceptance.policyVersionId, policyVersion.id)
							)
						)
				)
			)
		);
}

export async function getCurrentPolicies() {
	return db.select().from(policyVersion).where(eq(policyVersion.isCurrent, true));
}

export async function recordCurrentPolicyAcceptances(input: RecordCurrentPolicyAcceptancesInput) {
	const missingPolicies = await getMissingCurrentPolicies(input.userId);

	if (missingPolicies.length === 0) {
		return [];
	}

	await db.transaction(async (tx) => {
		for (const policy of missingPolicies) {
			await tx
				.insert(userPolicyAcceptance)
				.values({
					userId: input.userId,
					policyVersionId: policy.id,
					action: actionForPolicyType(policy.policyType),
					ipAddress: input.ipAddress ?? null,
					userAgent: input.userAgent ?? null
				})
				.onConflictDoNothing();
		}
	});

	return missingPolicies;
}
