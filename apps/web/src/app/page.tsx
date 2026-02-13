import { redirect } from 'next/navigation';

type SearchParamValue = string | string[] | undefined;
type SearchParams = Record<string, SearchParamValue> | undefined;

function toQueryString(searchParams: SearchParams): string {
  if (!searchParams) {
    return '';
  }

  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') {
      query.append(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
    }
  }

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
}

export default function HomePage({ searchParams }: { searchParams?: SearchParams }) {
  redirect(`/app${toQueryString(searchParams)}`);
}
