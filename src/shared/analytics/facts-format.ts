// Bump to force a full rebuild of every stored fact.
export const FACTS_FORMAT = 2

export const customerTypeSql = (alias: string) =>
  `case when ${alias}.customer_id is null then 'Guest' when ${alias}.is_new then 'New' else 'Returning' end`
