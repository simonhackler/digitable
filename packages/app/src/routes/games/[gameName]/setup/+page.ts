export const ssr = false;
import { collection, member, optional } from '$lib/collaboration/dependencies';
import type { PageLoad } from './$types';

export const load = (() => ({
	projectNeeds: {
		table: optional(member('table-setup', 'setup/table.svg')),
		svgs: collection('component-svg', 'components'),
		data: collection('component-data', 'components')
	}
})) satisfies PageLoad;
