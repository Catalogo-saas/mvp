import { redirect } from "next/navigation";
export default async function StatisticsRedirect({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
 const query=await searchParams; const params=new URLSearchParams();
 for(const key of ["period","from","to"]) if(typeof query[key]==="string")params.set(key,query[key]);
 redirect("/gestion"+(params.size?"?"+params.toString():""));
}
