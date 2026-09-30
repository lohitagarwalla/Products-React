import { useSearchParams } from "react-router-dom";

export default function useProductQuery() {
  const [params, setParams] = useSearchParams();
  const rawPage = Number(params.get("page") || 1);
  const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 1000000 ? rawPage : 1;
  const search = (params.get("search") || "").slice(0, 200);
  return { page, search,
    onSearch: value => setParams({ ...(value ? { search: value } : {}), page: "1" }),
    onPage: value => setParams({ ...(search ? { search } : {}), page: String(value) }) };
}
