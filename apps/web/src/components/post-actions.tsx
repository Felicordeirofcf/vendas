import { btnSmCls } from "@/components/ui";
import { deletePost, setPostStatus } from "@/lib/actions/schedule";

export function PostActions({ id, status }: { id: string; status: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {status !== "posted" ? (
        <form action={setPostStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="posted" /><button className={btnSmCls}>Marcar postado</button></form>
      ) : (
        <form action={setPostStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="pending" /><button className={btnSmCls}>Desfazer</button></form>
      )}
      {status === "pending" ? (
        <form action={setPostStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="skipped" /><button className={btnSmCls}>Pular</button></form>
      ) : null}
      <form action={deletePost}><input type="hidden" name="id" value={id} /><button className={`${btnSmCls} text-red-800`}>Excluir</button></form>
    </div>
  );
}
