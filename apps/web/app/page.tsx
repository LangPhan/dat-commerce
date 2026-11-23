import { AuthGuard } from "@/features/auth/auth-guard";
import { Editor } from "@/features/editor/editor";

export default function Page() {
  return (
    <AuthGuard requiredPermission="content:read">
      <Editor />
    </AuthGuard>
  );
}
