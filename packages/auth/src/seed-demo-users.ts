import { userExistsByEmail } from '@svg-table/db';

import { auth } from './server';

const demoUsers = [
	{
		name: 'Demo User 1',
		email: 'demo1@digitable.local',
		password: 'password1234'
	},
	{
		name: 'Demo User 2',
		email: 'demo2@digitable.local',
		password: 'password1234'
	}
];

async function main() {
	for (const demoUser of demoUsers) {
		if (await userExistsByEmail(demoUser.email)) {
			console.log(`Demo user already exists: ${demoUser.email}`);
			continue;
		}

		await auth.api.signUpEmail({
			body: demoUser
		});

		console.log(`Seeded demo user: ${demoUser.email}`);
	}
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
