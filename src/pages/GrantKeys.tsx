import { Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { APIKeys } from "./APIKeys";
import { JWTGrants } from "./JWTGrants";

export function GrantKeys() {
  const [params] = useSearchParams();
  return params.get("tab") === "jwt-grants" ? <JWTGrants /> : <APIKeys />;
}

export function LegacyGrantKeysRedirect() {
  const location = useLocation();
  const { id } = useParams();
  const params = new URLSearchParams(location.search);
  if (location.pathname === "/jwt-grants") params.set("tab", "jwt-grants");
  const search = params.toString();
  return <Navigate replace state={location.state} to={`/grant-keys${id ? `/${encodeURIComponent(id)}` : ""}${search ? `?${search}` : ""}${location.hash}`} />;
}
