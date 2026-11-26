import { permanentRedirect } from "next/navigation";

export default function StoreRootRedirectPage() {
  permanentRedirect("/");
}
